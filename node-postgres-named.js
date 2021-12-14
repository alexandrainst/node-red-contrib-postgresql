/**
 * This file is based on a copy of the library https://github.com/bwestergard/node-postgres-named/blob/master/main.js
 * by Björn Westergard <https://github.com/bwestergard>:
 * > Inspiration provided by a conversation with [Mike "ApeChimp" Atkins](https://github.com/apechimp).
 * > Support for prepared statements added by [nuarhu](https://github.com/nuarhu).
 * > Critical connection-pooling bugfix tediously diagnosed and patched by [Tony "tone81" Nguyen](https://github.com/tone81).
 * > [Mike "mfine15" Fine](https://github.com/mfine15) righted my unaesthetic mixing of double and single-quotes,
 * > and [Victor Quinn](https://github.com/victorquinn) fixed a spelling error.
 */

const tokenPattern = /(?<=\$)[a-zA-Z]([a-zA-Z0-9_]*)\b/g;

function numericFromNamed(sql, parameters) {
	const fillableTokens = new Set(Object.keys(parameters));
	const matchedTokens = new Set(sql.match(tokenPattern));

	const fillTokens = Array.from(matchedTokens).filter((token) => fillableTokens.has(token)).sort();
	const fillValues = Array.from(fillTokens).map((token) => parameters[token]);
	const unmatchedTokens = Array.from(matchedTokens).filter((token) => !fillableTokens.has(token));

	if (unmatchedTokens.length > 0) {
		throw new Error('Missing Parameters: ' + unmatchedTokens.join(', '));
	}

	const interpolatedSql = Array.from(fillTokens).reduce((partiallyInterpolated, token, index) => {
		const replaceAllPattern = new RegExp('\\$' + fillTokens[index] + '\\b', 'g');
		return partiallyInterpolated.replace(replaceAllPattern, '$' + (index + 1)); // PostgreSQL parameters are 1-indexed
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
		if (config && config.values && (typeof config.values === 'object')) {
			reparameterized = numericFromNamed(config.text, config.values);
			config.text = reparameterized.sql;
			config.values = reparameterized.values;
		}

		if (arguments.length === 1) {
			return originalQuery(config);
		} else if (arguments.length === 2 && (typeof values === 'function')) {
			return originalQuery(config, values);
		} else if (values === undefined || values === null || Array.isArray(values)) {
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
