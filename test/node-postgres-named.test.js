#!/usr/bin/env node
/**
 * Modified subset of https://github.com/bwestergard/node-postgres-named/blob/master/test/test.js
 * Rewritten without Mocha to avoid the dependency and requirements to newer Node.js.
 */

'use strict';

const assert = require('assert');
const named = require('../node-postgres-named.js');

let passed = 0;
let failed = 0;

function it(description, testFn) {
	try {
		testFn();
		console.log(`✓ ${description}`);
		passed++;
	} catch (error) {
		console.error(`✗ ${description}`);
		console.error(`  Error: ${error.message}`);
		failed++;
	}
}

function describe(description, fn) {
	console.log(`\n${description}`);
	fn();
}

console.log('Running node-postgres-named tests...\n');

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

// Loads the node with a minimal fake Node-RED runtime and a fake pg client, then sends one message through it.
async function runNode(nodeQuery, inMsg) {
	let NodeCtor;
	const fakeClient = {
		executed: [],
		query: async function (text) {
			this.executed.push(text);
			return { rows: [], command: 'SELECT', rowCount: 0 };
		},
		release: function () {},
	};
	const RED = {
		nodes: {
			registerType: (name, ctor) => { if (name === 'postgresql') { NodeCtor = ctor; } },
			createNode: function (node) {
				const handlers = {};
				node.on = (evt, fn) => { handlers[evt] = fn; };
				node.status = () => {};
				node.error = () => {};
				node.handlers = handlers;
			},
			getNode: () => ({ pgPool: { totalCount: 1, connect: async () => fakeClient } }),
		},
	};
	require('../postgresql.js')(RED);
	const node = new NodeCtor({ query: nodeQuery, postgreSQLConfig: 'cfg' });
	const sent = [];
	await node.handlers.input(inMsg, (m) => sent.push(m), () => {});
	return { sent: sent, executed: fakeClient.executed };
}

async function itAsync(description, testFn) {
	try {
		await testFn();
		console.log(`✓ ${description}`);
		passed++;
	} catch (error) {
		console.error(`✗ ${description}`);
		console.error(`  Error: ${error.message}`);
		failed++;
	}
}

async function runAsyncTests() {
	console.log('\nOutgoing msg.query');
	await itAsync('Node SQL replaces msg.query with the raw node SQL, while the rendered SQL is executed', async function () {
		const { sent, executed } = await runNode('SELECT {{{ msg.id }}}', { id: 5, query: 'SELECT old' });
		assert.deepEqual(executed, ['SELECT 5']);
		assert.equal(sent[0].query, 'SELECT {{{ msg.id }}}');
	});

	await itAsync('Empty node SQL leaves msg.query unaltered', async function () {
		const { sent, executed } = await runNode('', { query: 'SELECT 1' });
		assert.deepEqual(executed, ['SELECT 1']);
		assert.equal(sent[0].query, 'SELECT 1');
	});

	await itAsync('Empty node SQL leaves msg.query unaltered even with msg.queryParameters', async function () {
		const { sent, executed } = await runNode('', { query: 'SELECT $id', queryParameters: { id: 7 } });
		assert.deepEqual(executed, ['SELECT $1']);
		assert.equal(sent[0].query, 'SELECT $id');
	});
}

runAsyncTests().then(() => {
	console.log(`\n${'='.repeat(50)}`);
	console.log(`Tests completed: ${passed + failed} total`);
	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed}`);
	console.log('='.repeat(50));

	process.exit(failed > 0 ? 1 : 0);
});
