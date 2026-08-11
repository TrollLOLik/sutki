#!/bin/sh

set -eu

local_only=0
if [ "${1:-}" = "--local-only" ]; then
    local_only=1
fi

public_api_url=${PUBLIC_API_URL:-https://arenda.wigaj.ru}
public_web_url=${PUBLIC_WEB_URL:-https://wigaj.ru}
public_errors_url=${PUBLIC_ERRORS_URL:-https://errors.wigaj.ru}
local_api_url=${LOCAL_API_URL:-http://127.0.0.1:8080}

check_status() {
    name=$1
    method=$2
    url=$3
    expected=$4
    body=${5:-}

    if [ -n "$body" ]; then
        status=$(curl --silent --show-error --max-time 20 \
            --request "$method" \
            --header 'Content-Type: application/json' \
            --data "$body" \
            --output /dev/null \
            --write-out '%{http_code}' \
            "$url")
    else
        status=$(curl --silent --show-error --max-time 20 \
            --request "$method" \
            --output /dev/null \
            --write-out '%{http_code}' \
            "$url")
    fi

    if [ "$status" != "$expected" ]; then
        echo "$name failed: expected HTTP $expected, got $status ($url)" >&2
        return 1
    fi

    echo "$name: HTTP $status"
}

check_hsts() {
    name=$1
    url=$2

    if ! curl --fail --silent --show-error --max-time 20 --head "$url" \
        | grep -qi '^strict-transport-security:'; then
        echo "$name does not return Strict-Transport-Security" >&2
        return 1
    fi

    echo "$name: HSTS enabled"
}

echo "Checking loopback services..."
check_status "Local API health" GET "$local_api_url/healthz" 200

if [ "$local_only" -eq 1 ]; then
    echo "Local production smoke test passed."
    exit 0
fi

echo "Checking public domains..."
check_status "Public API health" GET "$public_api_url/healthz" 200
check_status "Public website health" GET "$public_web_url/healthz" 200
check_status "Public website home" GET "$public_web_url/" 200
check_status "Public website catalog" GET "$public_web_url/catalog" 200

errors_status=$(curl --silent --show-error --max-time 20 \
    --output /dev/null --write-out '%{http_code}' "$public_errors_url/")
case "$errors_status" in
    200|301|302)
        echo "Public GlitchTip: HTTP $errors_status"
        ;;
    *)
        echo "Public GlitchTip failed: HTTP $errors_status" >&2
        exit 1
        ;;
esac

check_hsts "Public API" "$public_api_url/healthz"
check_hsts "Public website" "$public_web_url/"
check_hsts "Public GlitchTip" "$public_errors_url/"

echo "Public production smoke test passed."
