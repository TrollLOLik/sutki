#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly APP_DIR="/opt/titop_arenda/app"
readonly ENV_FILE="${APP_DIR}/deploy/.env.production"
readonly COMPOSE_FILE="${APP_DIR}/deploy/compose.production.yml"
readonly BACKUP_ROOT="/var/backups/titop-arenda/postgres"
readonly REMOTE_CONFIG="/etc/titop-arenda-backup.env"
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

upload_encrypted_backup() {
  if [[ ! -r "${REMOTE_CONFIG}" ]]; then
    echo "Remote backup config not found; backup remains local only: ${REMOTE_CONFIG}"
    return
  fi

  # This root-owned file contains the dedicated Timeweb S3 credentials.
  set -a
  # shellcheck disable=SC1090
  source "${REMOTE_CONFIG}"
  set +a

  : "${AWS_ACCESS_KEY_ID:?set AWS_ACCESS_KEY_ID in ${REMOTE_CONFIG}}"
  : "${AWS_SECRET_ACCESS_KEY:?set AWS_SECRET_ACCESS_KEY in ${REMOTE_CONFIG}}"
  : "${AWS_DEFAULT_REGION:?set AWS_DEFAULT_REGION in ${REMOTE_CONFIG}}"
  : "${BACKUP_S3_ENDPOINT:?set BACKUP_S3_ENDPOINT in ${REMOTE_CONFIG}}"
  : "${BACKUP_S3_BUCKET:?set BACKUP_S3_BUCKET in ${REMOTE_CONFIG}}"
  : "${BACKUP_ENCRYPTION_KEY:?set BACKUP_ENCRYPTION_KEY in ${REMOTE_CONFIG}}"

  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required for remote backups" >&2
    exit 1
  fi

  local encrypted_archive checksum_file archive_name checksum_name
  local archive_key checksum_key archive_hash
  archive_name="${STAMP}.tar.enc"
  checksum_name="${archive_name}.sha256"
  encrypted_archive="$(mktemp "${BACKUP_ROOT}/.upload-${STAMP}-XXXXXX.enc")"
  checksum_file="${encrypted_archive}.sha256"
  trap 'rm -f -- "${encrypted_archive}" "${checksum_file}"' RETURN

  tar -C "${BACKUP_ROOT}" -cf - "${STAMP}" | openssl enc \
    -aes-256-cbc \
    -salt \
    -pbkdf2 \
    -iter 200000 \
    -pass env:BACKUP_ENCRYPTION_KEY \
    -out "${encrypted_archive}"

  test -s "${encrypted_archive}"
  archive_hash="$(sha256sum "${encrypted_archive}" | awk '{print $1}')"
  printf '%s  %s\n' "${archive_hash}" "${archive_name}" >"${checksum_file}"

  archive_key="postgres/${archive_name}"
  checksum_key="postgres/${checksum_name}"

  aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 cp \
    "${encrypted_archive}" \
    "s3://${BACKUP_S3_BUCKET}/${archive_key}" \
    --region "${AWS_DEFAULT_REGION}" \
    --only-show-errors

  aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 cp \
    "${checksum_file}" \
    "s3://${BACKUP_S3_BUCKET}/${checksum_key}" \
    --region "${AWS_DEFAULT_REGION}" \
    --only-show-errors

  aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3api head-object \
    --bucket "${BACKUP_S3_BUCKET}" \
    --key "${archive_key}" \
    --region "${AWS_DEFAULT_REGION}" >/dev/null

  rm -f -- "${encrypted_archive}" "${checksum_file}"
  trap - RETURN
  echo "Encrypted backup uploaded: s3://${BACKUP_S3_BUCKET}/${archive_key}"
}

upload_encrypted_backup

# Only timestamp-named backup directories under the fixed backup root qualify.
find "${BACKUP_ROOT}" \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -name '????????T??????Z' \
  -mtime "+${RETENTION_DAYS}" \
  -exec rm -rf -- {} +

echo "PostgreSQL backup completed: ${FINAL_DIR}"
