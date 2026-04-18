#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

read_env_value() {
  key="$1"
  file="$2"

  if [ ! -f "$file" ]; then
    return 1
  fi

  value="$(sed -n "s/^${key}=//p" "$file" | head -n 1)"
  if [ -z "$value" ]; then
    return 1
  fi

  printf '%s' "$value"
}

for file in "$ROOT_DIR/.env.local" "$ROOT_DIR/.env"; do
  if [ -z "${NGROK_AUTHTOKEN:-}" ] && value="$(read_env_value NGROK_AUTHTOKEN "$file")"; then
    export NGROK_AUTHTOKEN="$value"
  fi

  if [ -z "${NGROK_REGION:-}" ] && value="$(read_env_value NGROK_REGION "$file")"; then
    export NGROK_REGION="$value"
  fi

  if [ -z "${NGROK_CONFIG:-}" ] && value="$(read_env_value NGROK_CONFIG "$file")"; then
    export NGROK_CONFIG="$value"
  fi
done

if [ -z "${NGROK_AUTHTOKEN:-}" ]; then
  echo "NGROK_AUTHTOKEN is not set. Add it to apps/mobile/.env.local before running start:tunnel."
  exit 1
fi

exec /opt/homebrew/opt/node@20/bin/node "$ROOT_DIR/scripts/start-remote-dev.mjs" "$@"
