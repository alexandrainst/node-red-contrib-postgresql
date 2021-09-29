'use strict';

/**
 * Return an incoming node ID if the node has any input wired to it, false otherwise.
 * If filter callback is not null, then this function filters incoming nodes.
 * @param {Object} toNode
 * @param {function} filter
 * @return {(number|boolean)}
 */
function findInputNodeId(toNode, filter = null) {
	if (toNode && toNode._flow && toNode._flow.global) {
		const allNodes = toNode._flow.global.allNodes;
		for (const fromNodeId of Object.keys(allNodes)) {
			const fromNode = allNodes[fromNodeId];
			if (fromNode.wires) {
				for (const wireId of Object.keys(fromNode.wires)) {
					const wire = fromNode.wires[wireId];
					for (const toNodeId of wire) {
						if (toNode.id === toNodeId && (!filter || filter(fromNode))) {
							return fromNode.id;
						}
					}
				}
			}
		}
	}
	return false;
}

module.exports = function (RED) {
	const Mustache = require('mustache');
	const Pool = require('pg').Pool;
	const Cursor = require('pg-cursor');

	function getField(node, kind, value) {
		switch (kind) {
			case 'flow':
				return node.context().flow.get(value);
			case 'global':
				return node.context().global.get(value);
			case 'num':
				return parseInt(value);
			case 'bool':
				return JSON.parse(value);
			case 'env':
				return process.env[value];
			default:
				return value;
		}
	}

	function PostgreSQLConfigNode(n) {
		const node = this;
		RED.nodes.createNode(node, n);
		node.name = n.name;
		node.host = n.host;
		node.hostFieldType = n.hostFieldType;
		node.port = n.port;
		node.portFieldType = n.portFieldType;
		node.database = n.database;
		node.databaseFieldType = n.databaseFieldType;
		node.ssl = n.ssl;
		node.sslFieldType = n.sslFieldType;
		node.max = n.max;
		node.maxFieldType = n.maxFieldType;
		node.min = n.min;
		node.minFieldType = n.minFieldType;
		node.idle = n.idle;
		node.idleFieldType = n.idleFieldType;
		node.user = n.user;
		node.userFieldType = n.userFieldType;
		node.password = n.password;
		node.passwordFieldType = n.passwordFieldType;
		node.connectionTimeout = n.connectionTimeout;
		node.connectionTimeoutFieldType = n.connectionTimeoutFieldType;

		this.pgPool = new Pool({
			user: getField(node, n.userFieldType, n.user),
			password: getField(node, n.passwordFieldType, n.password),
			host: getField(node, n.hostFieldType, n.host),
			port: getField(node, n.portFieldType, n.port),
			database: getField(node, n.databaseFieldType, n.database),
			ssl: getField(node, n.sslFieldType, n.ssl),
			max: getField(node, n.maxFieldType, n.max),
			min: getField(node, n.minFieldType, n.min),
			idleTimeoutMillis: getField(node, n.idleFieldType, n.idle),
			connectionTimeoutMillis: getField(node, n.connectionTimeoutFieldType, n.connectionTimeout),
		});
	}

	RED.nodes.registerType('postgreSQLConfig', PostgreSQLConfigNode);

	function PostgreSQLNode(config) {
		const node = this;
		RED.nodes.createNode(node, config);
		node.topic = config.topic;
		node.query = config.query;
		node.split = config.split;
		node.rowsPerMsg = config.rowsPerMsg;
		node.config = RED.nodes.getNode(config.postgreSQLConfig);

		// Declare the ability of this node to provide ticks upstream for back-pressure
		node.tickProvider = true;
		let tickUpstreamId;
		let tickUpstreamNode;

		// Declare the ability of this node to consume ticks from downstream for back-pressure
		node.tickConsumer = true;
		let downstreamReady = true;

		// For streaming from PostgreSQL
		let cursor;
		let getNextRows;

		node.on('input', async (msg) => {
			if (tickUpstreamId === undefined) {
				tickUpstreamId = findInputNodeId(node, (n) => RED.nodes.getNode(n.id).tickConsumer);
				tickUpstreamNode = tickUpstreamId ? RED.nodes.getNode(tickUpstreamId) : null;
			}

			if (msg.tick) {
				downstreamReady = true;
				if (getNextRows) {
					getNextRows();
				}
			} else {
				const partsId = Math.random();
				const query = Mustache.render(node.query, { msg });

				let client = null;

				const handleDone = () => {
					if (cursor) {
						cursor.close();
						cursor = null;
					}
					if (client) {
						client.release(true);
						client = null;
					}
					getNextRows = null;
				};

				const handleError = (err) => {
					console.error(err);
					const error = (err ? err.toString() : 'Unknown error!') + ' ' + query;
					node.error(error);
					handleDone();
					msg.payload = error;
					msg.parts = {
						id: partsId,
						abort: true,
					};
					downstreamReady = false;
					node.send(msg);
				};

				handleDone();
				downstreamReady = true;

				try {
					client = await node.config.pgPool.connect();

					if (node.split) {
						let partsIndex = 0;
						delete msg.complete;

						cursor = client.query(new Cursor(query, msg.params || []));

						const cursorcallback = (err, rows, result) => {
							if (err) {
								handleError(err);
							} else {
								const done = rows.length < node.rowsPerMsg;
								if (done) {
									handleDone();
								}
								const msg2 = Object.assign({}, msg, {
									payload: (node.rowsPerMsg || 1) > 1 ? rows : rows[0],
									pgsql: {
										command: result.command,
										rowCount: result.rowCount,
									},
									parts: {
										id: partsId,
										type: 'array',
										index: partsIndex,
									},
								});
								if (msg.parts) {
									msg2.parts.parts = msg.parts;
								}
								if (done) {
									msg2.parts.count = partsIndex + 1;
									msg2.complete = true;
								}
								partsIndex++;
								downstreamReady = false;
								node.send(msg2);
								if (done) {
									if (tickUpstreamNode) {
										tickUpstreamNode.receive({ tick: true });
									}
								} else {
									getNextRows();
								}
							}
						};

						getNextRows = () => {
							if (downstreamReady) {
								cursor.read(node.rowsPerMsg || 1, cursorcallback);
							}
						};
					} else {
						getNextRows = async () => {
							try {
								const result = await client.query(query, msg.params || []);
								if (result.length) {
									// Multiple queries
									msg.payload = [];
									msg.pgsql = [];
									for (const r of result) {
										msg.payload = msg.payload.concat(r.rows);
										msg.pgsql.push({
											command: r.command,
											rowCount: r.rowCount,
											rows: r.rows,
										});
									}
								} else {
									msg.payload = result.rows;
									msg.pgsql = {
										command: result.command,
										rowCount: result.rowCount,
									};
								}

								handleDone();
								downstreamReady = false;
								node.send(msg);
								if (tickUpstreamNode) {
									tickUpstreamNode.receive({ tick: true });
								}
							} catch (ex) {
								handleError(ex);
							}
						};
					}

					getNextRows();
				} catch (err) {
					handleError(err);
				}
			}
		});

		node.on('close', () => node.status({}));
	}

	RED.nodes.registerType('postgresql', PostgreSQLNode);
};
