module.exports = function(RED) {
  'use strict';
  const mustache = require('mustache');
  const PgPool = require('pg').Pool;
  const co = require('co');

  let pgPool = null;

  function getObjectValue(obj, str) {
    try {
      return str.split(/\.|\[/g).map(function (crumb) {
        return crumb.replace(/\]$/, '').trim().replace(/^(["'])((?:(?!\1)[^\\]|\\.)*?)\1$/, (match, quote, str) => str.replace(/\\(\\)?/g, "$1"));
      }).reduce(function (obj, prop) {
        return obj ? obj[prop] : undefined;
      }, obj);
    } catch (err) {
      return false;
    }
  };

  function PostgresDBNode(n) {
    let poolInstance = null;
    const node = this;
    const config = node.context().global.config;
    const configValues = {
      host: getObjectValue(config, n.host) || n.host,
      port: getObjectValue(config, n.port) || n.port,
      database: getObjectValue(config, n.database) || n.database,
      ssl: getObjectValue(config, 'postgres.ssl') || n.ssl,
      max: getObjectValue(config, n.max) || n.max,
      min: getObjectValue(config, n.min) || n.min,
      idle: getObjectValue(config, n.idle) || n.idle
    };
    RED.nodes.createNode(this, n);
    node.name = configValues.name;
    node.host = configValues.host;
    node.port = configValues.port;
    node.database = configValues.database;
    node.ssl = configValues.ssl;
    node.max = configValues.max;
    node.min = configValues.min;
    node.idle = configValues.idle;
    if (node.credentials) {
      node.user = getObjectValue(config, node.credentials.user) || node.credentials.user;
      node.password = getObjectValue(config, node.credentials.password) || node.credentials.password;
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
            msg.err = error;
          }
          finally {
            node.send(msg);
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
