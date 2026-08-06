#!/bin/sh
set -eu

module_dir="/local-module"
module_name="node-red-contrib-postgresql"

cd /data
mkdir -p node_modules
rm -rf "node_modules/$module_name"

node -e '
	const fs = require("node:fs");
	const dependencies = require("/local-module/package.json").dependencies;
	const manifest = { private: true, dependencies };
	fs.writeFileSync("/data/package.json", JSON.stringify(manifest, null, 2) + "\n");
'
npm install --omit=dev --no-audit --no-fund
ln -s "$module_dir" "node_modules/$module_name"

export NODE_PATH="/data/node_modules"
cd /usr/src/node-red
exec /usr/src/node-red/entrypoint.sh
