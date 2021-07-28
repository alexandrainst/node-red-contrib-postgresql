# node-red-contrib-postgresql

[node-red-contrib-postgresql](https://github.com/alexandrainst/node-red-contrib-postgresql) 👾 is a [**Node-RED**](https://nodered.org/) to query a [**PostgreSQL**](https://www.postgresql.org/) 🐘 database.

It supports *splitting* the resultset and *backpressure* (flow control), to allow working with large datasets.

It supports *parameterized queries* (passed as a parameter array `params` of the `msg` object).

`msg.payload` will contain the result object of the query. It has the following properties:

* `command`: The SQL command that was executed (e.g. "SELECT", "UPDATE", etc.)
* `rowCount`: The number of rows affected by the SQL statement
* `oid`: The oid returned
* `rows`: An array of rows

There is a template engine allowing parameterized queries:

```sql
/* INTEGER id COLUMN */
SELECT * FROM table WHERE id = {{ msg.id }};

/* VARCHAR id COLUMN */
SELECT * FROM table WHERE id = '{{ msg.id }}';

SELECT * FROM table where name = $1;
```

```js
msg.params = ['Andrea'];
```

## Installation

### Using the Node-RED Editor

You can install [**node-red-contrib-postgresql**](https://flows.nodered.org/node/node-red-contrib-postgresql) directly using the editor:
Select *Manage Palette* from the menu (top right), and then select the *Install* tab in the palette.

### Installing npm packaged nodes

You can also install [**node-red-contrib-postgresql**](https://www.npmjs.com/package/node-red-contrib-postgresql) npm-packaged node:

* Locally within your user data directory (by default, ```$HOME/.node-red```):

```sh
cd $HOME/.node-red
npm i node-red-contrib-postgresql
```

* or globally alongside Node-RED:

```sh
npm i -g node-red-contrib-postgresql
```

You will then need to restart Node-RED.

## Backpressure

This node supports *backpressure* / *flow control*:
when the *Split results* option is enabled, it waits for a *tick* before releasing the next batch of lines, to make sure the rest of your Node-RED flow is ready to process more data
(instead of risking an out-of-memory condition), and also conveys this information upstream.

So this node will only output one message at first, and then await a message containing a truthy `msg.tick` before releasing the next message.

To make this behaviour potentially automatic (avoiding manual wires), this node declares its ability by exposing a truthy `node.tickConsumer` for downstream nodes to detect this feature, and a truthy `node.tickProvider` for upstream nodes.
Likewise, this node detects upstream nodes using the same back-pressure convention, and automatically sends ticks.
