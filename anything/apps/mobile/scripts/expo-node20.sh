#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
NODE20_BIN="/opt/homebrew/opt/node@20/bin/node"
EXPO_CLI="$PROJECT_DIR/node_modules/@expo/cli/build/bin/cli"

if [ -x "$NODE20_BIN" ]; then
  cd "$PROJECT_DIR"
  exec "$NODE20_BIN" "$EXPO_CLI" "$@"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node is not installed."
  echo "Install Node 20 or export PATH=\"/opt/homebrew/opt/node@20/bin:\$PATH\"."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

if [ "$NODE_MAJOR" != "20" ]; then
  echo "Expo dev commands for this project require Node 20."
  echo "Current node: $(node -v)"
  echo "Use: export PATH=\"/opt/homebrew/opt/node@20/bin:\$PATH\""
  exit 1
fi

cd "$PROJECT_DIR"
exec node "$EXPO_CLI" "$@"
