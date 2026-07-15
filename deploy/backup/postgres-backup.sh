#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly APP_DIR="/opt/titop_arenda/app"
readonly ENV_FILE="${APP_DIR}/deploy/.env.production"
readonly COMPOSE_FILE="${APP_DIR}/deploy/compose.production.yml"
readonly BACKUP_ROOT="/var/backups/titop-arenda/postgres"
readonly RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
readonly STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
readonly FINAL_DIR="${BACKUP_ROOT}/${STAMP}"

if [[ ! -r "${ENV_FILE}" ]]; then
  echo "Production environment file is not readable: ${ENV_FILE}" >&2
  exit 1
fi

install -d -m 0700 "${BACKUP_ROOT}"
work_dir="$(mktemp -d "${BACKUP_ROOT}/.tmp-${STAMP}-XXXXXX")"
trap 'rm -rf -- "${work_dir}"' EXIT

compose=(
  docker compose
  --env-file "${ENV_FILE}"
  -f "${COMPOSE_FILE}"
)

dump_database() {
  local database="$1"
  local output="${work_dir}/${database}.dump"

  "${compose[@]}" exec -T postgres pg_dump \
    --username=postgres \
    --dbname="${database}" \
    --format=custom \
    --compress=6 \
    --no-owner \
    --no-acl >"${output}"

  test -s "${output}"
}

dump_database "titop_arenda"
dump_database "titop_glitchtip"

"${compose[@]}" exec -T postgres pg_dumpall \
  --username=postgres \
  --globals-only \
  --no-role-passwords | gzip -6 >"${work_dir}/postgres-globals.sql.gz"

test -s "${work_dir}/postgres-globals.sql.gz"
(
  cd "${work_dir}"
  sha256sum titop_arenda.dump titop_glitchtip.dump postgres-globals.sql.gz >SHA256SUMS
)

mv "${work_dir}" "${FINAL_DIR}"
trap - EXIT

# Only timestamp-named backup directories under the fixed backup root qualify.
find "${BACKUP_ROOT}" \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -name '????????T??????Z' \
  -mtime "+${RETENTION_DAYS}" \
  -exec rm -rf -- {} +

echo "PostgreSQL backup completed: ${FINAL_DIR}"
