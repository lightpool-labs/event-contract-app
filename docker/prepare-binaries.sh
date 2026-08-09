#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/docker/dist"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
NODE_VERSION="${NODE_VERSION:-20.18.1}"

mkdir -p "$DIST"

echo "==> Building backend (release)"
(
  cd "$BACKEND"
  cargo build --release
)
cp "$BACKEND/target/release/event-contract-backend" "$DIST/event-contract-backend"
chmod +x "$DIST/event-contract-backend"

echo "==> Building frontend (standalone)"
(
  cd "$FRONTEND"
  if [[ ! -d node_modules ]]; then
    npm ci
  fi
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:3001/api}" \
  NEXT_PUBLIC_EVM_RPC_URL="${NEXT_PUBLIC_EVM_RPC_URL:-http://127.0.0.1:8545}" \
  NEXT_PUBLIC_EVM_CHAIN_ID="${NEXT_PUBLIC_EVM_CHAIN_ID:-1337}" \
  NEXT_TELEMETRY_DISABLED=1 \
    npm run build
)

rm -rf "$DIST/frontend"
mkdir -p "$DIST/frontend"
cp -a "$FRONTEND/.next/standalone/." "$DIST/frontend/"
mkdir -p "$DIST/frontend/.next/static"
cp -a "$FRONTEND/.next/static/." "$DIST/frontend/.next/static/"
if [[ -d "$FRONTEND/public" ]]; then
  mkdir -p "$DIST/frontend/public"
  cp -a "$FRONTEND/public/." "$DIST/frontend/public/"
fi

echo "==> Fetching Node ${NODE_VERSION} runtime binary"
NODE_ARCH="$(uname -m)"
case "$NODE_ARCH" in
  x86_64|amd64) NODE_ARCH=x64 ;;
  aarch64|arm64) NODE_ARCH=arm64 ;;
  *)
    echo "unsupported arch: $NODE_ARCH" >&2
    exit 1
    ;;
esac
NODE_TGZ="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TGZ}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$NODE_URL" -o "$TMP/$NODE_TGZ"
tar -xJf "$TMP/$NODE_TGZ" -C "$TMP"
cp "$TMP/node-v${NODE_VERSION}-linux-${NODE_ARCH}/bin/node" "$DIST/node"
chmod +x "$DIST/node"

echo "==> Done: $DIST"
ls -lah "$DIST/event-contract-backend" "$DIST/node"
du -sh "$DIST/frontend"
