/**
 * This file is based on a copy of the library https://www.npmjs.com/package/node-postgres-named
 *
 * https://github.com/bwestergard/node-postgres-named/blob/master/main.js
 * Björn Westergard <https://github.com/bwestergard>:
 * Inspiration provided by a conversation with [Mike "ApeChimp" Atkins](https://github.com/apechimp).
 * Support for prepared statements added by [nuarhu](https://github.com/nuarhu).
 * Critical connection-pooling bugfix tediously diagnosed and patched by [Tony "tone81" Nguyen](https://github.com/tone81).
 * [Mike "mfine15" Fine](https://github.com/mfine15) righted my unaesthetic mixing of double and single-quotes,
 * and [Victor Quinn](https://github.com/victorquinn) fixed a spelling error.
 *
 * https://github.com/RaphaelAguiar/node-postgres-named/blob/master/main.js
 */

const _ = require('lodash');

const tokenPattern = /(?<=\s)(\$[a-zA-Z]([a-zA-Z0-9_]*)\b)/g;

function numericFromNamed(sql, parameters) {
	const fillableTokens = Object.keys(parameters);
	const matchedTokens = _.uniq(_.map(sql.match(tokenPattern), function (token) {
		return token.substring(1); // Remove leading dollar sign
	}));

	const fillTokens = _.intersection(fillableTokens, matchedTokens).sort();
	const fillValues = _.map(fillTokens, function (token) {
		return parameters[token];
	});

	const unmatchedTokens = _.difference(matchedTokens, fillableTokens);

	if (unmatchedTokens.length) {
		const missing = unmatchedTokens.join(', ');
		throw new Error('Missing Parameters: ' + missing);
	}

	const interpolatedSql = _.reduce(fillTokens,
		function (partiallyInterpolated, token, index) {
			const replaceAllPattern = new RegExp('\\$' + fillTokens[index] + '\\b', 'g');
			return partiallyInterpolated
				.replace(replaceAllPattern,
					'$' + (index + 1)); // PostGreSQL parameters are inexplicably 1-indexed.
		}, sql);

	const out = {};
	out.sql = interpolatedSql;
	out.values = fillValues;

	return out;
}

function patch(client) {
	let originalQuery = client.query;

	if (originalQuery.patched) return client;

	originalQuery = originalQuery.bind(client);

	const patchedQuery = function (config, values, callback) {
		let reparameterized;
		if (_.isPlainObject(config) && _.isPlainObject(config.values)) {
			reparameterized = numericFromNamed(config.text, config.values);
			config.text = reparameterized.sql;
			config.values = reparameterized.values;
		}

		if (arguments.length === 1) {
			return originalQuery(config);
		} else if (arguments.length === 2 && _.isFunction(values)) {
			return originalQuery(config, values);
		} else if (_.isUndefined(values) || _.isNull(values) || _.isArray(values)) {
			return originalQuery(config, values, callback);
		} else {
			reparameterized = numericFromNamed(config, values);
			return originalQuery(reparameterized.sql, reparameterized.values, callback);
		}
	};

	client.query = patchedQuery;
	client.query.patched = true;

	return client;
}

module.exports.patch = patch;
