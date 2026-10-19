#!/bin/sh
# Optional cross-host Linux arm64 portable build. Requires Docker.
set -eu
docker run --rm -v "$PWD:/workspace" -w /workspace \
  -e CARGO_HOME=/workspace/tools/cargo-linux rust:1-bookworm sh -ec '
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev libxdo-dev > /workspace/tools/linux-packages.log
    cargo build --release --locked --no-default-features --bin cloud-study-core --target aarch64-unknown-linux-gnu
    mkdir -p binaries
    cp target/aarch64-unknown-linux-gnu/release/cloud-study-core binaries/cloud-study-core-aarch64-unknown-linux-gnu
    cargo build --release --locked --bin cloud-study --features custom-protocol --target aarch64-unknown-linux-gnu
  '
