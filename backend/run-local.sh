#!/bin/bash
# Run the backend locally without Docker

# Load environment variables from .env.local if it exists
if [ -f ../.env.local ]; then
    echo "Loading environment from .env.local..."
    set -a
    source ../.env.local
    set +a
else
    echo "Warning: .env.local not found, using default values"
    export DATABASE_URL="postgresql://fassandra_user:dev_password_123@localhost:5432/fassandra_db"
    export BACKEND_PORT=3000
    export RUST_LOG=debug
    export ALLOWED_ORIGINS="http://localhost:8080,http://localhost:3000,http://127.0.0.1:8080"
    export JWT_SECRET="local_dev_jwt_secret_not_for_production"
fi

cargo run --bin backend
