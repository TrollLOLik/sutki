#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
env_file=${ENV_FILE:-$repo_root/deploy/.env.production}
compose_file=${COMPOSE_FILE:-$repo_root/deploy/compose.production.yml}
review_email=${1:-${REVIEW_AUTH_EMAIL:-}}

case "$review_email" in
    *@*.*) ;;
    *)
        echo "usage: sh deploy/scripts/create-review-account.sh review@wigaj.ru" >&2
        exit 2
        ;;
esac

if [ ! -f "$env_file" ]; then
    echo "production environment file not found: $env_file" >&2
    exit 1
fi

cd "$repo_root"

docker compose \
    --env-file "$env_file" \
    -f "$compose_file" \
    exec -T -e REVIEW_ACCOUNT_EMAIL="$review_email" postgres sh -lc \
    'psql -U "$APP_DB_USER" -d "$APP_DB_NAME" -v ON_ERROR_STOP=1 -v review_email="$REVIEW_ACCOUNT_EMAIL"' <<'SQL'
BEGIN;

SELECT pg_advisory_xact_lock(hashtext(lower(:'review_email')));

WITH existing AS (
    UPDATE "user"
    SET deleted = false,
        enable = true,
        is_verified = true,
        updated_at = now()
    WHERE lower(email) = lower(:'review_email')
    RETURNING id
), inserted AS (
    INSERT INTO "user" (
        name, email, phone, phone_normalized, phone_verified_at, roles,
        deleted, is_verified, enable, created_at, updated_at
    )
    SELECT
        'Модератор RuStore', lower(:'review_email'), NULL, NULL, NULL,
        '["ROLE_USER"]'::jsonb, false, true, true, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM existing)
    RETURNING id
)
SELECT id, 'ready' AS status FROM existing
UNION ALL
SELECT id, 'created' AS status FROM inserted;

COMMIT;

SELECT
    id, email, name, phone IS NULL AS phone_is_empty,
    enable, deleted, created_at
FROM "user"
WHERE lower(email) = lower(:'review_email');
SQL

echo "RuStore review account is ready: $review_email"
echo "No phone, admin role, listings, bookings, chats, or consents were added."
