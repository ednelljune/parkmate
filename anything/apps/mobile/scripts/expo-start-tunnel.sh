#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
APP_JSON="$ROOT_DIR/app.json"

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

load_first_env_value() {
  key="$1"
  shift

  for file in "$@"; do
    if value="$(read_env_value "$key" "$file")"; then
      printf '%s' "$value"
      return 0
    fi
  done

  return 1
}

ENV_FILES="$ROOT_DIR/.env.local $ROOT_DIR/.env"

if [ -z "${NGROK_AUTHTOKEN:-}" ]; then
  for file in $ENV_FILES; do
    if value="$(load_first_env_value NGROK_AUTHTOKEN "$file")"; then
      export NGROK_AUTHTOKEN="$value"
      break
    fi
  done
fi

if [ -z "${NGROK_REGION:-}" ]; then
  for file in $ENV_FILES; do
    if value="$(load_first_env_value NGROK_REGION "$file")"; then
      export NGROK_REGION="$value"
      break
    fi
  done
fi

if [ -z "${NGROK_CONFIG:-}" ]; then
  for file in $ENV_FILES; do
    if value="$(load_first_env_value NGROK_CONFIG "$file")"; then
      export NGROK_CONFIG="$value"
      break
    fi
  done
fi

if [ -z "${EXPO_TUNNEL_SUBDOMAIN:-}" ] && [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  export EXPO_TUNNEL_SUBDOMAIN=1
fi

if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  echo "Using custom ngrok account for Expo tunnel."
else
  echo "NGROK_AUTHTOKEN is not set. Expo will fall back to its shared tunnel service, which is the path currently failing with 'remote gone away'."
  echo "Set NGROK_AUTHTOKEN in apps/mobile/.env.local or your shell to make --tunnel use your own ngrok account."
fi

SCHEME="$(node -e "const app=require(process.argv[1]); process.stdout.write(app.expo?.scheme || '')" "$APP_JSON")"

if [ -z "$SCHEME" ]; then
  echo "Missing expo.scheme in $APP_JSON"
  exit 1
fi

exec sh "$ROOT_DIR/scripts/expo-node20.sh" start --clear --dev-client --host tunnel --scheme "$SCHEME" "$@"
