#!/usr/bin/env bash
set -Eeuo pipefail

readonly ENV_FILE="/opt/titop_arenda/app/deploy/.env.production"
readonly FAILED_UNIT="${1:-unknown.service}"

if ! command -v curl >/dev/null 2>&1; then
  echo "Required command is missing: curl" >&2
  exit 1
fi

if [[ ! -r "${ENV_FILE}" ]]; then
  echo "Production environment file is not readable: ${ENV_FILE}" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local line value

  line="$(grep -m 1 -E "^${key}=" "${ENV_FILE}" || true)"
  value="${line#*=}"
  value="${value%$'\r'}"

  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "${value}"
}

GLITCHTIP_BACKEND_DSN="$(read_env_value GLITCHTIP_BACKEND_DSN)"
APP_RELEASE="$(read_env_value APP_RELEASE)"

if [[ -z "${GLITCHTIP_BACKEND_DSN:-}" ]]; then
  echo "GLITCHTIP_BACKEND_DSN is not configured" >&2
  exit 1
fi

if [[ ! "${GLITCHTIP_BACKEND_DSN}" =~ ^(https?)://([^@]+)@([^/]+)/([0-9]+)$ ]]; then
  echo "GLITCHTIP_BACKEND_DSN has an unsupported format" >&2
  exit 1
fi

readonly protocol="${BASH_REMATCH[1]}"
readonly public_key="${BASH_REMATCH[2]}"
readonly host="${BASH_REMATCH[3]}"
readonly project_id="${BASH_REMATCH[4]}"
readonly endpoint="${protocol}://${host}/api/${project_id}/envelope/"
readonly event_id="$(tr -d '-' </proc/sys/kernel/random/uuid)"
readonly sent_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

event_message="Monthly PostgreSQL restore drill failed"
event_level="error"
if [[ "${FAILED_UNIT}" == "manual-test.service" ]]; then
  event_message="PostgreSQL restore monitoring smoke test"
  event_level="info"
fi

envelope_header="$(printf \
  '{"event_id":"%s","dsn":"%s","sent_at":"%s"}' \
  "${event_id}" "${GLITCHTIP_BACKEND_DSN}" "${sent_at}")"
event_payload="$(printf \
  '{"event_id":"%s","timestamp":"%s","platform":"other","level":"%s","environment":"production","release":"%s","logger":"systemd","message":"%s","tags":{"failed_unit":"%s","component":"postgres-backup"}}' \
  "${event_id}" "${sent_at}" "${event_level}" "${APP_RELEASE:-unknown}" "${event_message}" "${FAILED_UNIT}")"

printf '%s\n%s\n%s\n' \
  "${envelope_header}" \
  '{"type":"event"}' \
  "${event_payload}" | \
  curl \
    --fail \
    --silent \
    --show-error \
    --connect-timeout 5 \
    --max-time 15 \
    --header "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${public_key}, sentry_client=titop-systemd/1.0" \
    --header 'Content-Type: application/x-sentry-envelope' \
    --data-binary @- \
    "${endpoint}" >/dev/null

echo "GlitchTip failure event sent for ${FAILED_UNIT}"
