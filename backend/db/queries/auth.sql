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
SELECT id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday, vk_id
FROM "user"
WHERE email = $1 AND deleted = false;

-- name: GetUserByID :one
SELECT 
  u.id, u.name, u.surname, u.email, u.phone, u.city, u.avatar_url, u.is_verified, u.roles, u.birthday, u.vk_id,
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
INSERT INTO "user" (email, roles, deleted, is_verified, enable, created_at, updated_at)
VALUES ($1, $2, false, true, true, now(), now())
RETURNING id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday, vk_id;

-- name: UpdateUserProfile :one
UPDATE "user"
SET name = COALESCE(sqlc.narg('name'), name),
    phone = COALESCE(sqlc.narg('phone'), phone),
    city = COALESCE(sqlc.narg('city'), city),
    birthday = COALESCE(sqlc.narg('birthday'), birthday),
    avatar_url = COALESCE(sqlc.narg('avatar_url'), avatar_url),
    vk_id = CASE WHEN sqlc.narg('vk_id_do_null')::boolean = true THEN NULL ELSE COALESCE(sqlc.narg('vk_id'), vk_id) END,
    updated_at = now()
WHERE id = sqlc.arg('id') AND deleted = false
RETURNING id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday, vk_id;

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
RETURNING id, name, surname, email, phone, city, avatar_url, is_verified, roles, birthday, vk_id;

-- name: CheckUserActiveBookings :one
SELECT count(*)::bigint
FROM request r
JOIN house h ON h.id = r.house_id
WHERE (r.user_id = $1 OR h.owner_id = $1)
  AND (
    r.status = 'in_progress'
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


