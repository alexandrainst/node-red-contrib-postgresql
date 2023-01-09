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
			if (fromNode && fromNode.wires) {
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
	const { Client, Pool } = require('pg');
	const Cursor = require('pg-cursor');
	const named = require('./node-postgres-named.js');

	function getField(node, kind, value) {
		switch (kind) {
			case 'flow':	// Legacy
				return node.context().flow.get(value);
			case 'global':
				return node.context().global.get(value);
			case 'num':
				return parseInt(value);
			case 'bool':
			case 'json':
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
		node.applicationName = n.applicationName;
		node.applicationNameType = n.applicationNameType;
		node.max = n.max;
		node.maxFieldType = n.maxFieldType;
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
			application_name: getField(node, n.applicationNameType, n.applicationName),
			max: getField(node, n.maxFieldType, n.max),
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
		node.config = RED.nodes.getNode(config.postgreSQLConfig) || {
			pgPool: {
				totalCount: 0,
			},
		};

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

		// Do not update status faster than x ms
		const updateStatusPeriodMs = 1000;

		let nbQueue = 0;
		let hasError = false;
		let statusTimer = null;
		const updateStatus = (incQueue = 0, isError = false) => {
			nbQueue += incQueue;
			hasError |= isError;
			if (!statusTimer) {
				statusTimer = setTimeout(() => {
					let fill = 'grey';
					if (hasError) {
						fill = 'red';
					} else if (nbQueue <= 0) {
						fill = 'blue';
					} else if (nbQueue <= node.config.pgPool.totalCount) {
						fill = 'green';
					} else {
						fill = 'yellow';
					}
					node.status({
						fill,
						shape: hasError || nbQueue > node.config.pgPool.totalCount ? 'ring' : 'dot',
						text: 'Queue: ' + nbQueue + (hasError ? ' Error!' : ''),
					});
					hasError = false;
					statusTimer = null;
				}, updateStatusPeriodMs);
			}
		};
		updateStatus(0, false);

		node.on('input', async (msg, send, done) => {
			// 'send' and 'done' require Node-RED 1.0+
			send = send || function () { node.send.apply(node, arguments); };

			if (tickUpstreamId === undefined) {
				// TODO: Test with older versions of Node-RED:
				tickUpstreamId = findInputNodeId(node, (n) => n && n.tickConsumer);
				tickUpstreamNode = tickUpstreamId ? RED.nodes.getNode(tickUpstreamId) : null;
			}

			if (msg.tick) {
				downstreamReady = true;
				if (getNextRows) {
					getNextRows();
				}
			} else {
				const partsId = Math.random();
				let query = msg.query ? msg.query : Mustache.render(node.query, { msg });

				let client = null;

				const handleDone = async (isError = false) => {
					if (cursor) {
						cursor.close();
						cursor = null;
					}
					if (client) {
						if (client.release) {
							client.release(isError);
						} else if (client.end) {
							await client.end();
						}
						client = null;
						updateStatus(-1, isError);
					} else if (isError) {
						updateStatus(-1, isError);
					}
					getNextRows = null;
				};

				const handleError = (err) => {
					const error = (err ? err.toString() : 'Unknown error!') + ' ' + query;
					handleDone(true);
					msg.payload = error;
					msg.parts = {
						id: partsId,
						abort: true,
					};
					downstreamReady = false;
					if (err) {
						if (done) {
							// Node-RED 1.0+
							done(err);
						} else {
							// Node-RED 0.x
							node.error(err, msg);
						}
					}
				};

				handleDone();
				updateStatus(+1);
				downstreamReady = true;

				try {
					if (msg.pgConfig) {
						client = new Client(msg.pgConfig);
						await client.connect();
					} else {
						client = await node.config.pgPool.connect();
					}

					let params = [];
					if (msg.params && msg.params.length > 0) {
						params = msg.params;
					} else if (msg.queryParameters && (typeof msg.queryParameters === 'object')) {
						({ text: query, values: params } = named.convert(query, msg.queryParameters));
					}

					if (node.split) {
						let partsIndex = 0;
						delete msg.complete;

						cursor = client.query(new Cursor(query, params));

						const cursorcallback = (err, rows, result) => {
							if (err) {
								handleError(err);
							} else {
								const complete = rows.length < node.rowsPerMsg;
								if (complete) {
									handleDone(false);
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
								if (complete) {
									msg2.parts.count = partsIndex + 1;
									msg2.complete = true;
								}
								partsIndex++;
								downstreamReady = false;
								send(msg2);
								if (complete) {
									if (tickUpstreamNode) {
										tickUpstreamNode.receive({ tick: true });
									}
									if (done) {
										done();
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
								const result = await client.query(query, params);
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
								send(msg);
								if (tickUpstreamNode) {
									tickUpstreamNode.receive({ tick: true });
								}
								if (done) {
									done();
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
	}

	RED.nodes.registerType('postgresql', PostgreSQLNode);
};
