/**
 * https://github.com/bwestergard/node-postgres-named/blob/master/test/test.js
 */

/* globals it: false, describe: false */
const assert = require('assert');
const chai = require('chai');
const named = require('../node-postgres-named.js');

// Dummy Client class for testing purposes. No methods except query, which returns its arguments

function Client() {
}

Client.prototype.query = function (sql, values, callback) {
	const out = {};
	out.sql = sql;
	out.values = values;
	out.callback = callback;

	// prepared statement call with 2 arguments
	if (!callback && (typeof values === 'function') && (typeof sql === 'object')) {
		out.callback = values;
		out.values = sql.values;
		out.sql = sql.text;
	}
	return out;
};

const client = new Client();
named.patch(client);

describe('node-postgres-named', function () {
	describe('Parameter translation', function () {
		it('Basic Interpolation', function () {
			const results = client.query('$a $b $c', { a: 10, b: 20, c: 30 });
			assert.deepEqual(results.values, [10, 20, 30]);
			assert.equal(results.sql, '$1 $2 $3');
		});

		it('Lexicographic order of parameter keys differs from order of appearance in SQL string', function () {
			const results = client.query('$z $y $x', { z: 10, y: 20, x: 30 });
			assert.deepEqual(results.values, [30, 20, 10]);
			assert.equal(results.sql, '$3 $2 $1');
		});

		it('Missing Parameters', function () {
			const flawedCall = function () {
				client.query('$z $y $x', { z: 10, y: 20 });
			};
			chai.expect(flawedCall).to.throw('Missing Parameters: x');
		});

		it('Extra Parameters', function () {
			const okayCall = function () {
				client.query('$x $y $z', { w: 0, x: 10, y: 20, z: 30 });
			};
			chai.expect(okayCall).not.to.throw();
		});

		it('Handles word boundaries', function () {
			const results = client.query('$a $aa', { a: 5, aa: 23 });
			assert.deepEqual(results.values, [5, 23]);
			assert.equal(results.sql, ['$1 $2']);
		});
	});

	describe('Monkeypatched Dispatch', function () {
		it('Call with original signature results in unchanged call to original function', function () {
			const sql = 'SELECT name FORM person WHERE name = $1 AND tenure <= $2 AND age <= $3';
			const values = ['Ursus Oestergardii', 3, 24];
			const callback = function () { };
			const results = client.query(sql, values, callback);
			assert.equal(results.sql, sql);
			assert.deepEqual(results.values, values);
			assert.equal(callback, callback);
		});
		it('Call with no values results in unchanged call to original function', function () {
			const sql = 'SELECT name FORM person WHERE name = $1 AND tenure <= $2 AND age <= $3';
			const results = client.query(sql);
			assert.equal(results.sql, sql);
			assert.strictEqual(results.values, undefined);
			assert.strictEqual(results.callback, undefined);
		});
		it('Named parameter call dispatched correctly', function () {
			const sql = 'SELECT name FORM person WHERE name = $name AND tenure <= $tenure AND age <= $age';
			const values = {
				name: 'Ursus Oestergardii',
				tenure: 3,
				age: 24,
			};
			const callback = function () { };
			const results = client.query(sql, values, callback);
			assert.equal(results.sql, 'SELECT name FORM person WHERE name = $2 AND tenure <= $3 AND age <= $1');
			assert.deepEqual(results.values, [24, 'Ursus Oestergardii', 3]);
			assert.equal(callback, callback);
		});
		it('Prepared statement call', function () {
			const prepStmt = {
				name: 'select.person.byNameTenureAge',
				text: 'SELECT name FORM person WHERE name = $name AND tenure <= $tenure AND age <= $age',
				values: {
					name: 'Ursus Oestergardii',
					tenure: 3,
					age: 24,
				},
			};
			const callback = function () { };
			const results = client.query(prepStmt, callback);
			assert.equal(results.sql, 'SELECT name FORM person WHERE name = $2 AND tenure <= $3 AND age <= $1');
			assert.deepEqual(results.values, [24, 'Ursus Oestergardii', 3]);
			assert.equal(callback, callback);
		});
	});
});
