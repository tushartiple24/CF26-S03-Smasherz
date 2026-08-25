#!/usr/bin/env bash
# Creates the database (if needed), applies schema.sql, loads seed.sql.
# Usage: ./scripts/setup_db.sh
# Reads the same S03_DB_* env vars as src/db.py (falls back to local defaults).

set -euo pipefail

HOST="${S03_DB_HOST:-localhost}"
PORT="${S03_DB_PORT:-5432}"
DBNAME="${S03_DB_NAME:-s03_cascade}"
USER="${S03_DB_USER:-postgres}"
export PGPASSWORD="${S03_DB_PASSWORD:-postgres}"

echo "Creating database '${DBNAME}' if it doesn't exist..."
psql -h "$HOST" -p "$PORT" -U "$USER" -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname = '${DBNAME}'" | grep -q 1 || \
  psql -h "$HOST" -p "$PORT" -U "$USER" -d postgres -c "CREATE DATABASE ${DBNAME}"

echo "Applying schema..."
psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DBNAME" -f "$(dirname "$0")/../sql/schema.sql"

echo "Loading seed scenarios..."
psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DBNAME" -f "$(dirname "$0")/../sql/seed.sql"

echo "Done. Try: python3 scripts/self_test.py"