#!/bin/sh
set -eu

node_red_url="${NODE_RED_URL:-http://127.0.0.1:1880}"
ready_url="$node_red_url/postgresql-test/ready"
test_url="$node_red_url/postgresql-test/run"
attempt=0

until curl --fail --silent --max-time 2 "$ready_url" >/dev/null; do
	attempt=$((attempt + 1))
	if [ "$attempt" -ge 60 ]; then
		echo "Node-RED did not become ready within 60 seconds." >&2
		exit 1
	fi
	sleep 1
done

echo "Node-RED is ready; running the PostgreSQL integration flow."
response="$(curl --fail --silent --show-error --max-time 120 --request POST "$test_url")"
printf '%s\n' "$response"
