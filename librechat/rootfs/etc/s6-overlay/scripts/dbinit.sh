#!/bin/bash
# One-shot database initialization, invoked by the s6 dbinit oneshot service.
PG_BIN=/usr/lib/postgresql/17/bin

# Wait for PostgreSQL to accept connections (up to 120 s)
i=0
until gosu postgres "$PG_BIN/pg_isready" -q -U ferretdb -d postgres -h 127.0.0.1 -p 5432; do
    i=$((i + 1))
    if [ "$i" -ge 120 ]; then
        echo "PostgreSQL did not become ready"
        exit 1
    fi
    sleep 1
done

# Create the FerretDB database once
if ! gosu postgres "$PG_BIN/psql" -U ferretdb -h 127.0.0.1 -p 5432 -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='ferretdb'" | grep -q 1; then
    echo "Creating FerretDB database"
    gosu postgres "$PG_BIN/psql" -U ferretdb -h 127.0.0.1 -p 5432 -d postgres \
        -c "CREATE DATABASE ferretdb OWNER ferretdb;"
fi

# Ensure the DocumentDB extension is present in it (CASCADE pulls in
# documentdb_core, which the "documentdb" extension depends on)
echo "Ensuring DocumentDB extension"
gosu postgres "$PG_BIN/psql" -U ferretdb -h 127.0.0.1 -p 5432 -d ferretdb \
    -c "CREATE EXTENSION IF NOT EXISTS documentdb CASCADE;"
