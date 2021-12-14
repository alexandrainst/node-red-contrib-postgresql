/**
 * Modified subset of https://github.com/bwestergard/node-postgres-named/blob/master/test/test.js
 */

/* globals it: false, describe: false */
const assert = require('assert');
const named = require('../node-postgres-named.js');

describe('node-postgres-named', function () {
	describe('Parameter translation', function () {
		it('Basic Interpolation', function () {
			const results = named.convert('$a $b $c', { a: 10, b: 20, c: 30 });
			assert.deepEqual(results.values, [10, 20, 30]);
			assert.equal(results.text, '$1 $2 $3');
		});

		it('Lexicographic order of parameter keys differs from order of appearance in SQL string', function () {
			const results = named.convert('$z $y $x', { z: 10, y: 20, x: 30 });
			assert.deepEqual(results.values, [30, 20, 10]);
			assert.equal(results.text, '$3 $2 $1');
		});

		it('Missing Parameters', function () {
			const flawedCall = function () {
				named.convert('$z $y $x', { z: 10, y: 20 });
			};
			assert.throws(flawedCall, /^Error: Missing Parameters: x$/);
		});

		it('Extra Parameters', function () {
			const okayCall = function () {
				named.convert('$x $y $z', { w: 0, x: 10, y: 20, z: 30 });
			};
			assert.doesNotThrow(okayCall);
		});

		it('Handles word boundaries', function () {
			const results = named.convert('$a $aa', { a: 5, aa: 23 });
			assert.deepEqual(results.values, [5, 23]);
			assert.equal(results.text, ['$1 $2']);
		});
	});

	describe('Monkeypatched Dispatch', function () {
		it('Call with no values results in unchanged call to original function', function () {
			const sql = 'SELECT name FORM person WHERE name = $1 AND tenure <= $2 AND age <= $3';
			const results = named.convert(sql, []);
			assert.equal(results.text, sql);
			assert.deepEqual(results.values, []);
		});
		it('Named parameter call dispatched correctly', function () {
			const sql = 'SELECT name FORM person WHERE name = $name AND tenure <= $tenure AND age <= $age';
			const values = {
				name: 'Ursus Oestergardii',
				tenure: 3,
				age: 24,
			};
			const results = named.convert(sql, values);
			assert.equal(results.text, 'SELECT name FORM person WHERE name = $2 AND tenure <= $3 AND age <= $1');
			assert.deepEqual(results.values, [24, 'Ursus Oestergardii', 3]);
		});
	});
});
