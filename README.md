# node-red-contrib-postgrestor-next

[node-red-contrib-postgrestor-next](https://github.com/andreabat/node-red-contrib-postgrestor) 👾 is a [**Node-RED**](https://nodered.org/) node allowing basic access to [**PostgreSQL**](https://www.postgresql.org/) 🐘 database.

It allows **parameterized query** (pass them as a parameter array ***params** of the `msg` object).

`msg.payload` will contain the result object of the query. It has the following properties:

* `command`: The SQL command that was executed (e.g. "SELECT", "UPDATE", etc.)
* `rowCount`: The number of rows affected by the SQL statement
* `oid`: The oid returned
* `rows`: An array of rows

There is a template engine allowing parameterized queries:

```sql
/* INTEGER id COLUMN */
SELECT * FROM table WHERE id = {{ msg.id }}

/* VARCHAR id COLUMN */
SELECT * FROM table WHERE id = '{{ msg.id }}'

SELECT * FROM table where name = $1;
```

```js
msg.params = ['Andrea'];
```

## Installation

### Using the Node-RED Editor

From version 0.15 of [**Node-RED**](https://nodered.org/) you can install [**node-red-contrib-postgrestor-next**](https://flows.nodered.org/node/node-red-contrib-postgrestor-next) directly using the editor.
To do this select ```Manage Palette``` from the menu (top right), and then select the ```install``` tab in the palette.

### Installing npm packaged nodes

You can also install [**node-red-contrib-postgrestor-next**](https://www.npmjs.com/package/node-red-contrib-postgrestor-next) npm-packaged node:

* Locally within your user data directory (by default, ```$HOME/.node-red```):

```sh
cd $HOME/.node-red
npm i node-red-contrib-postgrestor-next
```

* or globally alongside Node-RED:

```sh
npm i -g node-red-contrib-postgrestor-next
```

You will then need to restart Node-RED.

[![NPM](https://nodei.co/npm/node-red-contrib-postgrestor-next.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/node-red-contrib-postgrestor-next/)

## Screenshots

<p align="center">
	<img src="https://i.imgur.com/D03T3vH.png" width="600" />
	<img src="https://i.imgur.com/43qkUp5.png" width="600" />
	<img src="https://i.imgur.com/yYaO09Q.png" width="600" />
	<img src="https://i.imgur.com/7vDSn1r.png" width="600" />
</p>
