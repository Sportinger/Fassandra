# --- Planner Stage ---
# This stage is solely for resolving and downloading dependencies and updating Cargo.lock
FROM rust:1.82.0-slim-bullseye AS planner
WORKDIR /app

# Install build dependencies needed for planner stage (pkg-config for openssl-sys, libssl-dev)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        pkg-config libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set up cargo environment
ENV CARGO_HOME=/usr/local/cargo
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ARG DATABASE_URL="postgres://dummyuser:dummypass@dummyhost:5432/dummydb"
ENV DATABASE_URL=${DATABASE_URL}
# SQLX_OFFLINE not needed in planner stage - only downloads dependencies

# Copy backend's Cargo.toml and Cargo.lock (from build context root)
COPY Cargo.toml ./Cargo.toml
COPY Cargo.lock ./Cargo.lock

# Pin yrs version. The version is specified as "0.24.0" in Cargo.toml's [dependencies].
# Running `cargo update -p yrs --precise 0.24.0` ensures Cargo.lock reflects this exact version.
# The [patch.crates-io] section is not needed if we are just pinning to a crates.io version.
# RUN { echo; echo '[patch.crates-io]'; echo 'yrs = { version = "0.24.0" }'; } >> Cargo.toml
RUN cargo update -p yrs --precise 0.24.0

# Create dummy main.rs for the backend crate to allow cargo commands to work
RUN mkdir -p src && \
    echo "fn main() {println!(\"Dummy backend main for planner\");}" > src/main.rs

# Fetch all dependencies as per updated Cargo.lock
RUN cargo fetch --locked

# Ensure .fingerprint and git cache directories exist for the COPY --from=planner below
RUN mkdir -p /app/target/.fingerprint /app/target/release/.fingerprint /app/target/release/deps
RUN mkdir -p /usr/local/cargo/git

# --- Builder Stage ---
FROM rust:1.82.0-slim-bullseye AS builder
ARG BUILD_TARGET_ARCH=x86_64-unknown-linux-gnu
ARG DATABASE_URL # Allow DATABASE_URL to be passed as a build-arg. Will be empty if not passed.
ENV PASSED_DATABASE_URL=${DATABASE_URL}
WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential pkg-config libssl-dev ca-certificates lld && \
    rm -rf /var/lib/apt/lists/*

# Install sqlx-cli
RUN cargo install sqlx-cli --version=0.7.4 --features rustls,postgres --no-default-features --locked

# Install cargo-watch for hot-reloading in development
RUN cargo install cargo-watch --locked

# Set up cargo environment
ENV CARGO_HOME=/usr/local/cargo
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

# Default SQLX_OFFLINE to true to use cached query data during build
# This ensures the build doesn't fail if the database is not available.
ENV SQLX_OFFLINE=true

# Copy pre-built artifacts and manifests from the planner stage,
# assuming /app in planner was the root for the backend crate.
COPY --from=planner /app/Cargo.toml ./Cargo.toml
COPY --from=planner /app/Cargo.lock ./Cargo.lock
COPY --from=planner /usr/local/cargo/registry /usr/local/cargo/registry/
COPY --from=planner /usr/local/cargo/git /usr/local/cargo/git/
COPY --from=planner /app/target/release/deps /app/target/release/deps/
COPY --from=planner /app/target/.fingerprint /app/target/.fingerprint/
COPY --from=planner /app/target/release/.fingerprint /app/target/release/.fingerprint/

# Copy full source code for backend
# Source paths are relative to the build context (./backend)
# Destination paths are relative to WORKDIR /app
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/

# Copy the pre-generated .sqlx directory (expected to be committed to the repo)
COPY .sqlx ./.sqlx/

# The cargo sqlx prepare step is kept but made non-critical.
# If a PASSED_DATABASE_URL is provided and works, it can refresh .sqlx.
# If not, the build relies on the .sqlx copied above.
RUN echo "Attempting to prepare/verify SQLx data (optional refresh)..." && \
    if [ -n "${PASSED_DATABASE_URL}" ]; then \
      echo "Using PASSED_DATABASE_URL for sqlx prepare/verify." && \
      SQLX_OFFLINE=false DATABASE_URL=${PASSED_DATABASE_URL} cargo sqlx prepare --workspace --check -- --all-targets || echo "cargo sqlx prepare --check with PASSED_DATABASE_URL failed or found issues, relying on copied .sqlx data."; \
    else \
      echo "PASSED_DATABASE_URL not set, skipping optional sqlx prepare/verify refresh. Relying on copied .sqlx data." ; \
    fi && \
    echo "Finished optional SQLx prepare/verify attempt."

# Final build of the actual application binaries.
# ENV SQLX_OFFLINE=true is already set from earlier in this stage.
RUN echo "Building main binaries with SQLX_OFFLINE=true..." && \
    cargo build --release --locked --target ${BUILD_TARGET_ARCH} --bin backend && \
    cargo build --release --locked --target ${BUILD_TARGET_ARCH} --bin hash_password && \
    echo "Finished building main binaries."

# --- Runtime Stage ---
FROM gcr.io/distroless/cc-debian12 AS runtime
WORKDIR /app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy OpenSSL 1.1.x shared libraries from the builder stage (Debian Bullseye)
# Distroless Debian 12 base (Bookworm) has libssl.so.3, but the binary was linked against libssl.so.1.1
COPY --from=builder /usr/lib/x86_64-linux-gnu/libssl.so.1.1 /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/lib/x86_64-linux-gnu/libcrypto.so.1.1 /usr/lib/x86_64-linux-gnu/

# Temporarily hardcode the path to eliminate variable expansion as a cause
COPY --from=builder /app/target/x86_64-unknown-linux-gnu/release/backend .
COPY --from=builder /app/target/x86_64-unknown-linux-gnu/release/hash_password ./hash_password

EXPOSE 3001
CMD ["./backend"]