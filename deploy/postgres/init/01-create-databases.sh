#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_db_name="$APP_DB_NAME" \
  -v app_db_user="$APP_DB_USER" \
  -v app_db_password="$APP_DB_PASSWORD" \
  -v glitchtip_db_name="$GLITCHTIP_DB_NAME" \
  -v glitchtip_db_user="$GLITCHTIP_DB_USER" \
  -v glitchtip_db_password="$GLITCHTIP_DB_PASSWORD" <<'EOSQL'
CREATE ROLE :"app_db_user" LOGIN PASSWORD :'app_db_password';
CREATE DATABASE :"app_db_name" OWNER :"app_db_user";
CREATE ROLE :"glitchtip_db_user" LOGIN PASSWORD :'glitchtip_db_password';
CREATE DATABASE :"glitchtip_db_name" OWNER :"glitchtip_db_user";
EOSQL
