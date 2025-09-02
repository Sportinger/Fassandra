#!/usr/bin/env bash
set -euo pipefail

# Creates the fassandra_user and fassandra_db in the running Postgres.
# Defaults assume docker-compose.dev.yml (service name "db") and default password for the postgres superuser.

PGHOST=${PGHOST:-db}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
PGPASSWORD=${PGPASSWORD:-${POSTGRES_PASSWORD:-postgres}}
SQL_FILE=${SQL_FILE:-"/app/scripts/create_fassandra_db.sql"}

export PGPASSWORD

echo "Creating role and database using $PGUSER@$PGHOST:$PGPORT ..."
psql "host=$PGHOST port=$PGPORT user=$PGUSER dbname=postgres" -f "$SQL_FILE"

echo "✅ fassandra_user/fassandra_db ensured."

