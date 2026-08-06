#!/bin/sh
set -eu

script_dir="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
compose_file="$script_dir/compose.yaml"
export NODE_RED_PORT="${NODE_RED_PORT:-0}"

cleanup() {
	docker compose -f "$compose_file" down --volumes --remove-orphans
}

trap cleanup EXIT
# Preserve the conventional interrupted-command exit code.
trap 'exit 130' INT TERM

command -v curl >/dev/null 2>&1 || {
	echo "cURL is required to run the integration test." >&2
	exit 1
}

mkdir -p "$script_dir/../../node_modules"
docker compose -f "$compose_file" up --detach --pull always
published_address="$(docker compose -f "$compose_file" port node-red 1880)"
published_port="${published_address##*:}"
NODE_RED_URL="http://127.0.0.1:$published_port" sh "$script_dir/run-test.sh"
