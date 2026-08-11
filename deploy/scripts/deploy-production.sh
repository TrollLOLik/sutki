#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
env_file=${ENV_FILE:-$repo_root/deploy/.env.production}
compose_file=${COMPOSE_FILE:-$repo_root/deploy/compose.production.yml}

if ! command -v docker >/dev/null 2>&1; then
    echo "docker is not installed or is not available in PATH" >&2
    exit 1
fi

if [ ! -f "$env_file" ]; then
    echo "production environment file not found: $env_file" >&2
    exit 1
fi

compose() {
    docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

wait_for_url() {
    name=$1
    url=$2
    attempt=1

    while [ "$attempt" -le 90 ]; do
        if curl --fail --silent --show-error --max-time 10 "$url" >/dev/null 2>&1; then
            echo "$name is ready: $url"
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    echo "$name did not become ready: $url" >&2
    return 1
}

cd "$repo_root"

echo "Validating production Compose configuration..."
compose config --quiet

echo "Building application images..."
compose build api media-worker

echo "Starting production services..."
compose up -d --remove-orphans

migration_id=$(compose ps -aq migrate)
if [ -z "$migration_id" ]; then
    echo "migration container was not created" >&2
    exit 1
fi

migration_attempt=1
while [ "$migration_attempt" -le 60 ]; do
    migration_state=$(docker inspect --format '{{.State.Status}} {{.State.ExitCode}}' "$migration_id")
    case "$migration_state" in
        "exited 0")
            echo "Database migrations completed successfully."
            break
            ;;
        exited\ *)
            echo "Database migrations failed: $migration_state" >&2
            compose logs --no-color --tail=100 migrate >&2
            exit 1
            ;;
    esac

    migration_attempt=$((migration_attempt + 1))
    sleep 2
done

if [ "$migration_attempt" -gt 60 ]; then
    echo "database migrations did not finish in time" >&2
    compose logs --no-color --tail=100 migrate >&2
    exit 1
fi

wait_for_url "API" "http://127.0.0.1:8080/healthz"

sh "$script_dir/smoke-production.sh" --local-only

compose ps

if [ "${RUN_PUBLIC_SMOKE:-0}" = "1" ]; then
    sh "$script_dir/smoke-production.sh"
else
    echo "Local deployment checks passed. Set RUN_PUBLIC_SMOKE=1 to verify public domains too."
fi
