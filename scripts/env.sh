#!/bin/sh
# Source from the repository root for the project-local Rust installation.
export CARGO_HOME="$PWD/tools/cargo"
export RUSTUP_HOME="$PWD/tools/rustup"
export PATH="$PWD/tools/bin:$CARGO_HOME/bin:$PATH"
