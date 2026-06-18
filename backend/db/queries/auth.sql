-- name: UpsertEmailLoginCode :exec
INSERT INTO email_login_code (email, code_hash, expires_at, attempts, created_at)
VALUES ($1, $2, $3, 0, now())
ON CONFLICT (email) DO UPDATE
SET code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    attempts = 0,
    created_at = now();

-- name: GetEmailLoginCode :one
SELECT email, code_hash, expires_at, attempts, created_at
FROM email_login_code
WHERE email = $1;

-- name: IncrementEmailLoginCodeAttempts :exec
UPDATE email_login_code SET attempts = attempts + 1 WHERE email = $1;

-- name: DeleteEmailLoginCode :exec
DELETE FROM email_login_code WHERE email = $1;

-- name: GetUserByEmail :one
SELECT id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday
FROM "user"
WHERE email = $1 AND deleted = false;

-- name: GetUserByID :one
SELECT id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday
FROM "user"
WHERE id = $1 AND deleted = false;

-- name: CreateUser :one
INSERT INTO "user" (email, roles, deleted, is_verified, enable, created_at, updated_at)
VALUES ($1, $2, false, true, true, now(), now())
RETURNING id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday;

-- name: UpdateUserProfile :one
UPDATE "user"
SET name = COALESCE(sqlc.narg('name'), name),
    phone = COALESCE(sqlc.narg('phone'), phone),
    city = COALESCE(sqlc.narg('city'), city),
    birthday = COALESCE(sqlc.narg('birthday'), birthday),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    updated_at = now()
WHERE id = sqlc.arg('id') AND deleted = false
RETURNING id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday;

-- name: CreateRefreshToken :exec
INSERT INTO refresh_token (user_id, token_hash, expires_at, created_at)
VALUES ($1, $2, $3, now());

-- name: GetRefreshToken :one
SELECT id, user_id, token_hash, expires_at, created_at, revoked_at
FROM refresh_token
WHERE token_hash = $1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_token SET revoked_at = now()
WHERE token_hash = $1 AND revoked_at IS NULL;

-- name: DeleteUser :exec
DELETE FROM "user" WHERE id = $1;

-- name: UpdateUserEmail :one
UPDATE "user"
SET email = $2,
    updated_at = now()
WHERE id = $1 AND deleted = false
RETURNING id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday;

