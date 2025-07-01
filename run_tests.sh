#!/bin/bash
helper/bash/cargo_speed.sh
set -e
set -o pipefail

# Function to check and install cargo tools
check_cargo_tools() {
    echo "Checking required cargo tools..."
    
    # Check and install cargo-tarpaulin
    if ! cargo tarpaulin --version &>/dev/null; then
        echo "Installing cargo-tarpaulin..."
        cargo install cargo-tarpaulin
    fi
}

# Get the path to sqlx
SQLX_PATH=$(which sqlx || echo "$HOME/.cargo/bin/sqlx")

# Function to setup test database
setup_test_db() {
    echo "Setting up test database..."
    # Create test database if it doesn't exist
    PGPASSWORD=theater psql -h localhost -U pessoa_user -d postgres -c "CREATE DATABASE test_db;" || true
    # Run migrations on test database
    cd backend
    DATABASE_URL="postgres://pessoa_user:theater@localhost:5432/test_db" "$SQLX_PATH" migrate run
    cd ..
}

# Function to run backend tests
run_backend_tests() {
    echo "Running backend tests..."
    cd backend
    # Run tests with coverage using cargo-tarpaulin
    DATABASE_URL="postgres://pessoa_user:theater@localhost:5432/test_db" JWT_SECRET=test_secret cargo tarpaulin --out Html --output-dir ../coverage/backend --exclude-files "tests/*" --exclude-files "src/tests/*" --exclude-files "src/main.rs" > ../backend_test_output.log 2>&1 || true
    # Run regular tests
    DATABASE_URL="postgres://pessoa_user:theater@localhost:5432/test_db" JWT_SECRET=test_secret cargo test -- --nocapture >> ../backend_test_output.log 2>&1 || true
    cd ..
}

# Function to run frontend tests
run_frontend_tests() {
    echo "Starting backend server for frontend tests..."
    cd backend
    DATABASE_URL="postgres://pessoa_user:theater@localhost:5432/test_db" JWT_SECRET=test_secret cargo run --bin backend > ../backend_server.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    # Wait for backend to be ready (simple check: wait for port 3001)
    for i in {1..20}; do
        if nc -z localhost 3001; then
            echo "Backend is up."
            break
        fi
        sleep 1
    done
    echo "Running frontend tests..."
    cd frontend
    npm run test:coverage > ../frontend_test_output.log 2>&1 || true
    cd ..
    echo "Running ignored backend tests that require a running backend..."
    echo "Running ignored backend tests that require a running backend..." >> ../backend_test_output.log
    cd backend
    DATABASE_URL="postgres://pessoa_user:theater@localhost:5432/test_db" JWT_SECRET=test_secret cargo test -- --ignored --nocapture >> ../backend_test_output.log 2>&1 || true
    cd ..
    echo "Stopping backend server after frontend tests..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID || true
    fi
}

# Create necessary directories
mkdir -p coverage/backend coverage/frontend

# Check and install required tools
check_cargo_tools

# Setup test database
setup_test_db

# Run all tests
run_backend_tests
run_frontend_tests

# Generate test summary
{
    echo "=== Test Summary ==="
    echo "Backend Tests:"
    grep "test result:" backend_test_output.log || true
    echo "Frontend Tests:"
    grep "Tests:" frontend_test_output.log || true
} > test_summary

# Generate test errors
{
    echo "=== Test Errors ==="
    echo "Backend Errors:"
    grep -A 5 "FAILED" backend_test_output.log || true
    echo "Frontend Errors:"
    grep -A 5 "FAIL" frontend_test_output.log || true
} > test_errors

# Generate coverage missing report
{
    echo "=== Coverage Missing Report ==="
    echo "Backend Coverage Gaps:"
    grep -A 5 "Uncovered Lines" backend_test_output.log || true
    echo "Frontend Coverage Gaps:"
    grep -A 5 "Uncovered Lines" frontend_test_output.log || true
} > test_coverage_missing

echo "Testing complete. Check the following files for results:"
echo "- test_summary: Overall test results"
echo "- test_errors: Failed tests"
echo "- test_coverage_missing: Coverage gaps"
echo "- backend_test_output.log: Detailed backend test output"
echo "- frontend_test_output.log: Detailed frontend test output" 