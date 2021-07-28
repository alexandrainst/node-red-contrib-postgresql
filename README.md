# node-red-contrib-postgresql

[node-red-contrib-postgresql](https://github.com/alexandrainst/node-red-contrib-postgresql) 👾 is a [**Node-RED**](https://nodered.org/) node allowing basic access to [**PostgreSQL**](https://www.postgresql.org/) 🐘 database.

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

From version 0.15 of [**Node-RED**](https://nodered.org/) you can install [**node-red-contrib-postgresql**](https://flows.nodered.org/node/node-red-contrib-postgresql) directly using the editor.
To do this select ```Manage Palette``` from the menu (top right), and then select the ```install``` tab in the palette.

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
