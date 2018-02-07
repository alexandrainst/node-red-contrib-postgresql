module.exports = function(RED) {
  'use strict';
  const mustache = require('mustache');
  const PgPool = require('pg').Pool;
  const co = require('co');

  let pgPool = null;

  function PostgresDBNode(n) {
    let poolInstance = null;
    RED.nodes.createNode(this, n);
    const _getField = (kind, key) => {
      let value = false;
      const node = this;
      switch (kind) {
        case 'flow': {
          value = node.context().flow.get(key);
          break;
        }
        case 'global': {
          value = node.context().global.get(key);
          break;
        }
        case 'num': {
          value = parseInt(key);
          break;
        }
        case 'bool': {
          value = JSON.parse(key);
          break;
        }
        default: {
          value = key;
          break;
        }
      }
      return value;
    };
    const node = this;
    node.name = n.name;
    node.host = _getField(n.hostFieldType, n.host);
    node.hostFieldType = n.hostFieldType;
    node.port = _getField(n.portFieldType, n.port);
    node.portFieldType = n.portFieldType;
    node.database = _getField(n.databaseFieldType, n.database);
    node.databaseFieldType = n.databaseFieldType;
    node.ssl = _getField(n.sslFieldType, n.ssl);
    node.sslFieldType = n.sslFieldType;
    node.max = _getField(n.maxFieldType, n.max);
    node.maxFieldType = n.maxFieldType;
    node.min = _getField(n.minFieldType, n.min);
    node.minFieldType = n.minFieldType;
    node.idle = _getField(n.idleFieldType, n.idle);
    node.idleFieldType = n.idleFieldType;
    if (node.credentials) {
      node.user = _getField(n.userFieldType, node.credentials.user);
      node.userFieldType = n.userFieldType;
      node.password = _getField(n.passwordFieldType, node.credentials.password);
      node.passwordFieldType = n.passwordFieldType;
    }
    console.log(node);
    class Pool extends PgPool {
      constructor() {
        if (!poolInstance) {
          super({
            user: node.user,
            password: node.password,
            host: node.host,
            port: node.port,
            database: node.database,
            ssl: node.ssl,
            max: node.max,
            min: node.min,
            idleTimeoutMillis: node.idle
          });
          poolInstance = this;
        }
        return poolInstance;
      }
    }
    pgPool = new Pool();
  }

  RED.nodes.registerType('postgresDB', PostgresDBNode, {
    credentials: {
      user: {type: 'text'},
      password: {type: 'text'}
    }
  });

  function PostgrestorNode(config) {
    const node = this;

    RED.nodes.createNode(node, config);
    node.topic = config.topic;
    node.config = RED.nodes.getNode(config.postgresDB);

    node.on('input', function(msg) {
      const template = {
        msg: msg
      };
      co(
        function* () {
          let client = yield pgPool
            .connect()
            .catch((error) => {
            node.error(error);
            });
          try {
            msg.payload = yield client.query(
              mustache.render(config.query, template)
            );
            node.send(msg);
          } catch (error) {
            node.error(error);
            msg.err = error;
          } finally {
            node.send(msg);
            client.release();
          }
        }
      );
    });

    node.on('close', function() {
      node.status({});
    });
  }
  RED.nodes.registerType('postgrestor', PostgrestorNode);
};
