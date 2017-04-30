# node-red-contrib-postgrestor
Postgrestor :space_invader: is a [**Node-RED**](http://nodered.org/) node allowing basic access to [**Postgres**](https://www.postgresql.org/) :elephant: database.

Postgrestor sets up a console to execute queries against the configured database.

```msg.payload``` will contain the result object of the query. It has the following properties:
* ```command```: The sql command that was executed (e.g. "SELECT", "UPDATE", etc.)
* ```rowCount```: The number of rows affected by the SQL statement
* ```oid```: The oid returned
* ```rows```: An array of rows

Postgres implements a template engine allowing parameterized queries:
```sql
/* INTEGER id COLUMN */
SELECT * FROM table where id = {{ msg.id }}

/* VARCHAR id COLUMN */
SELECT * FROM table where id = '{{ msg.id }}'

```



## Screen shots
<img src="http://i.imgur.com/D03T3vH.png" width="600">
<img src="http://i.imgur.com/ilNXol7.png" width="600">
