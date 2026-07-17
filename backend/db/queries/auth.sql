-- name: UpsertAuthCode :exec
INSERT INTO auth_code (
  channel, target, code_hash, expires_at, attempts, created_at, delivery_provider, delivery_id, delivery_cost
)
VALUES ($1, $2, $3, $4, 0, now(), $5, $6, $7)
ON CONFLICT (channel, target) DO UPDATE
SET code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    attempts = 0,
    created_at = now(),
    delivery_provider = EXCLUDED.delivery_provider,
    delivery_id = EXCLUDED.delivery_id,
    delivery_cost = EXCLUDED.delivery_cost;

-- name: GetAuthCode :one
SELECT channel, target, code_hash, expires_at, attempts, created_at, delivery_provider, delivery_id, delivery_cost
FROM auth_code
WHERE channel = $1 AND target = $2;

-- name: IncrementAuthCodeAttempts :exec
UPDATE auth_code SET attempts = attempts + 1 WHERE channel = $1 AND target = $2;

-- name: DeleteAuthCode :exec
DELETE FROM auth_code WHERE channel = $1 AND target = $2;

-- name: GetUserByEmail :one
SELECT id, name, surname, patronymic, email, phone, phone_normalized, phone_verified_at, city, avatar_url, is_verified, roles, birthday, vk_id
FROM "user"
WHERE email = $1 AND deleted = false;

-- name: GetUserByPhone :one
SELECT id, name, surname, patronymic, email, phone, phone_normalized, phone_verified_at, city, avatar_url, is_verified, roles, birthday, vk_id
FROM "user"
WHERE phone_normalized = $1 AND deleted = false;

-- name: GetUserByID :one
SELECT 
  u.id, u.name, u.surname, u.patronymic, u.email, u.phone, u.phone_normalized, u.phone_verified_at, u.city, u.avatar_url, u.is_verified, u.roles, u.birthday, u.vk_id,
  (
    SELECT count(*)::int
    FROM house h
    WHERE h.owner_id = u.id AND h.deleted = false
  ) AS listings_count,
  COALESCE((
    SELECT round(avg(rv.rating)::numeric, 1)
    FROM review rv
    JOIN house h ON h.id = rv.house_id
    WHERE h.owner_id = u.id AND rv.status = 'active'
  ), 0.0)::float8 AS rating
FROM "user" u
WHERE u.id = $1 AND u.deleted = false;

-- name: CreateUser :one
INSERT INTO "user" (email, phone, phone_normalized, phone_verified_at, roles, deleted, is_verified, enable, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, false, true, true, now(), now())
RETURNING id, name, surname, patronymic, email, phone, phone_normalized, phone_verified_at, city, avatar_url, is_verified, roles, birthday, vk_id;

-- name: UpdateUserProfile :one
UPDATE "user"
SET name = COALESCE(sqlc.narg('name'), name),
    surname = CASE WHEN sqlc.narg('surname')::text = '' THEN NULL ELSE COALESCE(sqlc.narg('surname')::text, surname) END,
    patronymic = CASE WHEN sqlc.narg('patronymic')::text = '' THEN NULL ELSE COALESCE(sqlc.narg('patronymic')::text, patronymic) END,
    phone = COALESCE(sqlc.narg('phone'), phone),
    city = COALESCE(sqlc.narg('city'), city),
    birthday = COALESCE(sqlc.narg('birthday'), birthday),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    vk_id = CASE WHEN sqlc.narg('vk_id_do_null')::boolean = true THEN NULL ELSE COALESCE(sqlc.narg('vk_id'), vk_id) END,
    phone_normalized = COALESCE(sqlc.narg('phone_normalized'), phone_normalized),
    phone_verified_at = COALESCE(sqlc.narg('phone_verified_at'), phone_verified_at),
    updated_at = now()
WHERE id = sqlc.arg('id') AND deleted = false
RETURNING id, name, surname, patronymic, email, phone, phone_normalized, phone_verified_at, city, avatar_url, is_verified, roles, birthday, vk_id;

-- name: UpdateUserPhone :one
UPDATE "user"
SET phone = $2,
    phone_normalized = $3,
    phone_verified_at = $4,
    updated_at = now()
WHERE id = $1 AND deleted = false
RETURNING id, name, surname, patronymic, email, phone, phone_normalized, phone_verified_at, city, avatar_url, is_verified, roles, birthday, vk_id;

-- name: CreateRefreshToken :one
INSERT INTO refresh_token (user_id, token_hash, expires_at, device_name, device_os, app_version, ip_address, location, last_active_at, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
RETURNING id;

-- name: GetRefreshToken :one
SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, device_name, device_os, app_version, ip_address, location, last_active_at
FROM refresh_token
WHERE token_hash = $1;

-- name: GetRefreshTokenByID :one
SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, device_name, device_os, app_version, ip_address, location, last_active_at
FROM refresh_token
WHERE id = $1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_token SET revoked_at = now()
WHERE token_hash = $1 AND revoked_at IS NULL;

-- name: RevokeRefreshTokenByID :exec
UPDATE refresh_token SET revoked_at = now()
WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;

-- name: RevokeAllOtherRefreshTokens :exec
UPDATE refresh_token SET revoked_at = now()
WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL;

-- name: UpdateRefreshTokenActiveTime :exec
UPDATE refresh_token SET last_active_at = $2
WHERE id = $1;

-- name: UpdateRefreshTokenLocation :exec
UPDATE refresh_token SET location = $2
WHERE id = $1;

-- name: ListActiveRefreshTokens :many
SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, device_name, device_os, app_version, ip_address, location, last_active_at
FROM refresh_token
WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
ORDER BY last_active_at DESC;

-- name: DeleteUser :exec
DELETE FROM "user" WHERE id = $1;

-- name: UpdateUserEmail :one
UPDATE "user"
SET email = $2,
    updated_at = now()
WHERE id = $1 AND deleted = false
RETURNING id, name, surname, patronymic, email, phone, phone_normalized, phone_verified_at, city, avatar_url, is_verified, roles, birthday, vk_id;

-- name: CheckUserActiveBookings :one
SELECT count(*)::bigint
FROM request r
JOIN house h ON h.id = r.house_id
WHERE (r.user_id = $1 OR h.owner_id = $1)
  AND (
    r.status IN ('in_progress', 'pending')
    OR (r.status = 'confirmed' AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE))
  );

-- name: CreatePersonalDataRevocation :exec
INSERT INTO personal_data_revocation (user_id, email_hash, revoked_at)
VALUES ($1, $2, now());

-- name: SoftDeleteUserHouses :exec
UPDATE house SET deleted = true, updated_at = now() WHERE owner_id = $1;

-- name: AnonymizeUser :exec
UPDATE "user" SET
    email = 'deleted_' || id || '@deleted.sutki.ru',
    name = 'Удаленный пользователь',
    surname = '',
    patronymic = '',
    password = NULL,
    google_id = NULL,
    vk_id = NULL,
    phone = '',
    phone_normalized = NULL,
    phone_verified_at = NULL,
    avatar_url = '',
    birthday = NULL,
    deleted = true,
    enable = false,
    code = NULL,
    date_code = NULL,
    updated_at = now()
WHERE id = $1;

-- name: DeleteUserRefreshTokens :exec
DELETE FROM refresh_token WHERE user_id = $1;

-- name: DeleteUserFavorites :exec
DELETE FROM favorite WHERE user_id = $1;

-- name: DeleteUserDeviceTokens :exec
DELETE FROM device_token WHERE user_id = $1;
