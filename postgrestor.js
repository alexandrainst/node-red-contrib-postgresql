module.exports = function(RED) {
  'use strict';
  const mustache = require('mustache');
  const PgPool = require('pg').Pool;
  const co = require('co');

  let pgPool = null;

  function PostgresDBNode(n) {
    let poolInstance = null;
    const node = this;

    RED.nodes.createNode(this, n);
    node.name = n.name;
    node.host = n.host;
    node.port = n.port;
    node.database = n.database;
    node.ssl = n.ssl;
    if (node.credentials) {
      node.user = node.credentials.user;
      node.password = node.credentials.password;
    }

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
      password: {type: 'password'}
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
            client.release();
          } catch (error) {
            node.error(error);
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
