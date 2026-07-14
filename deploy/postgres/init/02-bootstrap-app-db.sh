#!/bin/sh
set -eu

export PGPASSWORD="$APP_DB_PASSWORD"

# The application role owns the baseline objects. This lets the migration
# container alter legacy tables later without granting it superuser access.
psql -v ON_ERROR_STOP=1 --host 127.0.0.1 --username "$APP_DB_USER" --dbname "$APP_DB_NAME" --file /bootstrap/schema.sql
psql -v ON_ERROR_STOP=1 --host 127.0.0.1 --username "$APP_DB_USER" --dbname "$APP_DB_NAME" --file /bootstrap/catalog.sql
