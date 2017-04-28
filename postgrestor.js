module.exports = function(RED) {
  const PgPool = require('pg').Pool;
  const co = require('co');
  const named = require('node-postgres-named');

  function PostgresDBNode(config) {
    RED.nodes.createNode(this, config);
    this.name = config.name;
    this.host = config.host;
    this.port = config.port;
    this.database = config.database;
    this.ssl = config.ssl;
    if (this.credentials) {
      this.user = this.credentials.user;
      this.password = this.credentials.password;
    }
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
      const pgPool = new PgPool({
        user: node.config.user,
        password: node.config.password,
        host: node.config.host,
        port: node.config.port,
        database: node.config.database,
        ssl: node.config.ssl
      });

      pgPool.on('error', function(error) {
        node.error(error);
      });

      co(
        function* () {
          let client = yield pgPool.connect();
          named.patch(client);
          try {
            msg.payload = yield client.query(config.query);
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
