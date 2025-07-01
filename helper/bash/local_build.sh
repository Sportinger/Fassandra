#!/bin/bash
# Source cargo speed optimizations for faster Rust compilation
source "$(dirname "$0")/cargo_speed.sh"
# Change to the backend directory
cd "$(dirname "$0")/../../backend" || exit 1
# Build with SQLx offline mode enabled (using the .sqlx directory)
SQLX_OFFLINE=true cargo build "$@"
echo "Build completed successfully!"
