#!/bin/bash
# Run the backend locally without Docker

export DATABASE_URL="postgresql://fassandra_user:dev_password_123@localhost:5432/fassandra_db"
export BACKEND_PORT=3000
export RUST_LOG=debug
export ALLOWED_ORIGINS="http://localhost:8080,http://localhost:3000,http://127.0.0.1:8080"
export JWT_SECRET="local_dev_jwt_secret_not_for_production"

cargo run --bin backend
