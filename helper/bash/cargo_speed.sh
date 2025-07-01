#!/bin/bash

# Enable parallel compilation
export CARGO_BUILD_JOBS=$(nproc)

# Enable incremental compilation
export CARGO_INCREMENTAL=1

# Use sccache if available
if command -v sccache &> /dev/null; then
    export RUSTC_WRAPPER=sccache
fi

# Use faster linker if available
if command -v lld &> /dev/null; then
    export RUSTFLAGS="-C link-arg=-fuse-ld=lld"
fi

# Set cargo home to a persistent location
export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"

# Enable cargo's sparse registry protocol
export CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

# Docker-specific optimizations
if [ -f /.dockerenv ]; then
    # Use a persistent target directory in Docker
    export CARGO_TARGET_DIR="/tmp/cargo-target"
    mkdir -p "$CARGO_TARGET_DIR"
    
    # Enable Docker layer caching
    export CARGO_NET_GIT_FETCH_WITH_CLI=true
    
    # Use a local registry mirror if available
    if [ -n "$CARGO_REGISTRY_MIRROR" ]; then
        export CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
        export CARGO_REGISTRIES_CRATES_IO_INDEX="$CARGO_REGISTRY_MIRROR"
    fi
fi

# Execute the original command only if arguments were provided
if [ $# -gt 0 ]; then
    exec "$@"
fi