'use strict';

/**
 * Rewritten subset of the library https://github.com/bwestergard/node-postgres-named/blob/master/main.js
 * https://github.com/ksteckert/node-postgres-named/tree/patch-1
 */

const tokenPattern = /(?<=\$)[a-zA-Z]([a-zA-Z0-9_]*)\b/g;

function numericFromNamed(sql, parameters) {
	const fillableTokens = new Set(Object.keys(parameters));
	const matchedTokens = new Set(sql.match(tokenPattern));

	const unmatchedTokens = Array.from(matchedTokens).filter((token) => !fillableTokens.has(token));
	if (unmatchedTokens.length > 0) {
		throw new Error('Missing Parameters: ' + unmatchedTokens.join(', '));
	}

	const fillTokens = Array.from(matchedTokens).filter((token) => fillableTokens.has(token)).sort();
	const fillValues = fillTokens.map((token) => parameters[token]);

	const interpolatedSql = fillTokens.reduce((partiallyInterpolated, token, index) => {
		const replaceAllPattern = new RegExp('\\$' + fillTokens[index] + '\\b', 'g');
		return partiallyInterpolated.replace(replaceAllPattern, '$' + (index + 1)); // PostgreSQL parameters are 1-indexed
	}, sql);

	return {
		text: interpolatedSql,
		values: fillValues,
	};
}

module.exports.convert = numericFromNamed;
