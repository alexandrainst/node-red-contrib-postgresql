module.exports = function (RED) {
  'use strict';
  const mustache = require('mustache');
  const Pool = require('pg').Pool;

  function getField(node, kind, value) {
    switch (kind) {
      case 'flow': {
        return node.context().flow.get(value);
      }
      case 'global': {
        return node.context().global.get(value);
      }
      case 'num': {
        return parseInt(value);
      }
      case 'bool': {
        return JSON.parse(value);
      }
      default: {
        return value;
      }
    }
  }

  function PostgresDBNode(n) {
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
    this.pgPool = new Pool({
      user: getField(node, n.userFieldType, n.user),
      password: getField(node, n.passwordFieldType, n.password),
      host: getField(node, n.hostFieldType, n.host),
      port: getField(node, n.portFieldType, n.port),
      database: getField(node, n.databaseFieldType, n.database),
      ssl: getField(node, n.sslFieldType, n.ssl),
      max: getField(node, n.maxFieldType, n.max),
      min: getField(node, n.minFieldType, n.min),
      idleTimeoutMillis: getField(node, n.idleFieldType, n.iddle),
      connectionTimeoutMillis: 15000,
    });
  }

  RED.nodes.registerType('postgresDB', PostgresDBNode);

  let myPool = false;

  function PostgrestorNode(config) {
    const node = this;
    RED.nodes.createNode(node, config);
    node.topic = config.topic;
    node.config = RED.nodes.getNode(config.postgresDB);
    node.on('input', (msg) => {
      const query = mustache.render(config.query, { msg });
      //node.config.pgPool;

      const asyncQuery = async () => {
        let client = false;
        try {
          client = await node.config.pgPool.connect();
          msg.payload = await client.query(query, msg.params || []);
        } catch (err) {
          const error = err.toString();
          node.error(error);
          msg.payload = error;
        } finally {
          if (client) {
            client.release();
          }
          node.send(msg);
        }
      };
      asyncQuery();
    });
    node.on('close', () => node.status({}));
  }

  RED.nodes.registerType('postgrestor', PostgrestorNode);
};
