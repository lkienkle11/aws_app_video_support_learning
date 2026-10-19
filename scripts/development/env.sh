#!/bin/sh
# Source from the repository root for the project-local Rust installation.
if [ -x "$PWD/tools/cargo/bin/cargo" ]; then
  export CARGO_HOME="$PWD/tools/cargo"
  export RUSTUP_HOME="$PWD/tools/rustup"
  export PATH="$CARGO_HOME/bin:$PATH"
fi
export PATH="$PWD/tools/bin:$PATH"
