#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly APP_DIR="/opt/titop_arenda/app"
readonly ENV_FILE="${APP_DIR}/deploy/.env.production"
readonly COMPOSE_FILE="${APP_DIR}/deploy/compose.production.yml"
readonly REMOTE_CONFIG="/etc/titop-arenda-backup.env"
readonly RESTORE_ROOT="/var/tmp/titop-arenda-restore"
readonly RUN_ID="$(date -u +%Y%m%d%H%M%S)-$$"
readonly APP_RESTORE_DB="restore_arenda_${RUN_ID//-/_}"
readonly GLITCHTIP_RESTORE_DB="restore_glitchtip_${RUN_ID//-/_}"

if [[ ! -r "${ENV_FILE}" || ! -r "${REMOTE_CONFIG}" ]]; then
  echo "Production or backup environment file is not readable" >&2
  exit 1
fi

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

for command in aws docker openssl sha256sum tar; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command}" >&2
    exit 1
  fi
done

install -d -m 0700 "${RESTORE_ROOT}"
work_dir="$(mktemp -d "${RESTORE_ROOT}/${RUN_ID}-XXXXXX")"

compose=(
  docker compose
  --env-file "${ENV_FILE}"
  -f "${COMPOSE_FILE}"
)

cleanup() {
  local exit_code=$?
  set +e
  "${compose[@]}" exec -T postgres dropdb \
    --username=postgres --if-exists --force "${APP_RESTORE_DB}" >/dev/null 2>&1
  "${compose[@]}" exec -T postgres dropdb \
    --username=postgres --if-exists --force "${GLITCHTIP_RESTORE_DB}" >/dev/null 2>&1
  rm -rf -- "${work_dir}"
  exit "${exit_code}"
}
trap cleanup EXIT

latest_key="$(
  aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3api list-objects-v2 \
    --bucket "${BACKUP_S3_BUCKET}" \
    --prefix "postgres/" \
    --region "${AWS_DEFAULT_REGION}" \
    --query 'sort_by(Contents[?ends_with(Key, `.tar.enc`)], &LastModified)[-1].Key' \
    --output text
)"

if [[ -z "${latest_key}" || "${latest_key}" == "None" ]]; then
  echo "No encrypted PostgreSQL backup found in the bucket" >&2
  exit 1
fi

archive_name="$(basename "${latest_key}")"
checksum_name="${archive_name}.sha256"

aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 cp \
  "s3://${BACKUP_S3_BUCKET}/${latest_key}" \
  "${work_dir}/${archive_name}" \
  --region "${AWS_DEFAULT_REGION}" \
  --only-show-errors

aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 cp \
  "s3://${BACKUP_S3_BUCKET}/${latest_key}.sha256" \
  "${work_dir}/${checksum_name}" \
  --region "${AWS_DEFAULT_REGION}" \
  --only-show-errors

(
  cd "${work_dir}"
  sha256sum -c "${checksum_name}"
)

openssl enc -d \
  -aes-256-cbc \
  -pbkdf2 \
  -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "${work_dir}/${archive_name}" \
  -out "${work_dir}/backup.tar"

tar -tf "${work_dir}/backup.tar" >/dev/null
tar -xf "${work_dir}/backup.tar" -C "${work_dir}"

dump_dir="$(
  find "${work_dir}" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -name '????????T??????Z' \
    -print -quit
)"

if [[ -z "${dump_dir}" ]]; then
  echo "The encrypted archive contains no timestamped dump directory" >&2
  exit 1
fi

(
  cd "${dump_dir}"
  sha256sum -c SHA256SUMS
)

"${compose[@]}" exec -T postgres createdb \
  --username=postgres --template=template0 "${APP_RESTORE_DB}"
"${compose[@]}" exec -T postgres createdb \
  --username=postgres --template=template0 "${GLITCHTIP_RESTORE_DB}"

"${compose[@]}" exec -T postgres pg_restore \
  --username=postgres \
  --dbname="${APP_RESTORE_DB}" \
  --exit-on-error \
  --no-owner \
  --no-acl <"${dump_dir}/titop_arenda.dump"

"${compose[@]}" exec -T postgres pg_restore \
  --username=postgres \
  --dbname="${GLITCHTIP_RESTORE_DB}" \
  --exit-on-error \
  --no-owner \
  --no-acl <"${dump_dir}/titop_glitchtip.dump"

app_tables="$(
  "${compose[@]}" exec -T postgres psql \
    --username=postgres \
    --dbname="${APP_RESTORE_DB}" \
    --tuples-only \
    --no-align \
    --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
)"
glitchtip_tables="$(
  "${compose[@]}" exec -T postgres psql \
    --username=postgres \
    --dbname="${GLITCHTIP_RESTORE_DB}" \
    --tuples-only \
    --no-align \
    --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
)"

if (( app_tables == 0 || glitchtip_tables == 0 )); then
  echo "Restore produced an empty schema" >&2
  exit 1
fi

echo "Restore drill passed: app_tables=${app_tables}, glitchtip_tables=${glitchtip_tables}"
echo "Verified remote object: s3://${BACKUP_S3_BUCKET}/${latest_key}"
