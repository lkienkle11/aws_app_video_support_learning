#!/bin/sh
set -eu
if command -v cargo >/dev/null 2>&1; then
  echo "Using existing Rust toolchain"
else
  mkdir -p tools
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o tools/rustup-init.sh
  CARGO_HOME="$PWD/tools/cargo" RUSTUP_HOME="$PWD/tools/rustup" sh tools/rustup-init.sh -y --profile minimal --component rustfmt --component clippy --no-modify-path
fi
npm ci --cache ./tools/npm-cache
