-- name: GetHouseForBooking :one
SELECT id, owner_id, status
FROM house
WHERE id = @id AND deleted = false;

-- name: CreateRequest :one
INSERT INTO request (
  house_id, user_id, guest_id, email, name, surname, lastname, count, message, phone,
  start_date, end_date, status, created_at, updated_at
)
VALUES (
  @house_id::int, sqlc.narg('user_id'), sqlc.narg('guest_id'), LOWER(TRIM(sqlc.narg('email'))),
  @name, @surname, @lastname, @count::int,
  sqlc.narg('message'), @phone, @start_date, sqlc.narg('end_date'),
  @status::text, now(), now()
)
RETURNING
  id, COALESCE(house_id, 0)::int AS house_id, COALESCE(user_id, 0)::int AS user_id,
  COALESCE(guest_id, '')::text AS guest_id, COALESCE(email, '')::text AS email,
  name, surname, lastname, count, message, phone, start_date, end_date, status,
  created_at, updated_at, confirmed_at, rejection_reason;

-- name: GetRequestByID :one
SELECT
  r.id, COALESCE(r.house_id, 0)::int AS house_id, COALESCE(r.user_id, 0)::int AS user_id,
  COALESCE(r.guest_id, '')::text AS guest_id, COALESCE(r.email, '')::text AS email,
  r.name, r.surname, r.lastname, r.count, r.message, r.phone,
  r.start_date, r.end_date, r.status, r.created_at, r.updated_at,
  r.confirmed_at, r.rejection_reason,
  h.street AS house_street, h.house_number AS house_number,
  COALESCE(h.number_room, '')::text AS house_number_room,
  h.country AS house_city, h.price AS house_price, h.owner_id AS house_owner_id,
  COALESCE((SELECT f.path FROM file f WHERE f.house_id = h.id AND f.deleted = false ORDER BY f.position LIMIT 1), '')::text AS house_cover_path,
  -- guest profile from user table
  COALESCE(u.name, '')::text       AS guest_name,
  COALESCE(u.surname, '')::text    AS guest_surname,
  COALESCE(u.patronymic, '')::text AS guest_patronymic,
  COALESCE(u.avatar_url, '')::text AS guest_avatar_url,
  COALESCE(u.phone, '')::text      AS guest_phone_profile,
  COALESCE(u.is_verified, false)   AS guest_is_verified,
  COALESCE((
    SELECT round(avg(rv.rating)::numeric, 1)
    FROM review rv
    JOIN house hh ON hh.id = rv.house_id
    WHERE hh.owner_id = r.user_id AND rv.status = 'active'
  ), 0.0)::float8 AS guest_rating,
  (
    SELECT count(*)::int
    FROM review rv
    JOIN house hh ON hh.id = rv.house_id
    WHERE hh.owner_id = r.user_id AND rv.status = 'active'
  ) AS guest_reviews_count,
  -- owner profile from user table
  COALESCE(owner_u.name, '')::text       AS owner_name,
  COALESCE(owner_u.surname, '')::text    AS owner_surname,
  COALESCE(owner_u.patronymic, '')::text AS owner_patronymic,
  COALESCE(owner_u.avatar_url, '')::text AS owner_avatar_url,
  COALESCE(owner_u.phone, '')::text      AS owner_phone,
  COALESCE(owner_u.is_verified, false)   AS owner_is_verified,
  COALESCE((
    SELECT round(avg(rv.rating)::numeric, 1)
    FROM review rv
    JOIN house hh ON hh.id = rv.house_id
    WHERE hh.owner_id = h.owner_id AND rv.status = 'active'
  ), 0.0)::float8 AS owner_rating,
  (
    SELECT count(*)::int
    FROM review rv
    JOIN house hh ON hh.id = rv.house_id
    WHERE hh.owner_id = h.owner_id AND rv.status = 'active'
  ) AS owner_reviews_count
FROM request r
JOIN house h ON h.id = r.house_id
LEFT JOIN "user" u ON u.id = r.user_id
LEFT JOIN "user" owner_u ON owner_u.id = h.owner_id
WHERE r.id = @id;

-- name: ListRequestsByUser :many
SELECT
  r.id, COALESCE(r.house_id, 0)::int AS house_id, COALESCE(r.user_id, 0)::int AS user_id,
  COALESCE(r.guest_id, '')::text AS guest_id, COALESCE(r.email, '')::text AS email,
  r.name, r.surname, r.lastname, r.count, r.message, r.phone,
  r.start_date, r.end_date, r.status, r.created_at, r.updated_at,
  r.confirmed_at, r.rejection_reason,
  h.street AS house_street, h.house_number AS house_number,
  COALESCE(h.number_room, '')::text AS house_number_room,
  h.country AS house_city, h.price AS house_price, h.owner_id AS house_owner_id,
  COALESCE((SELECT f.path FROM file f WHERE f.house_id = h.id AND f.deleted = false ORDER BY f.position LIMIT 1), '')::text AS house_cover_path
FROM request r
JOIN house h ON h.id = r.house_id
WHERE r.user_id = @user_id::int
  AND (
    @scope::text = 'all'
    OR (@scope::text = 'active' AND (
      r.status = 'in_progress'
      OR (r.status = 'confirmed' AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE))
    ))
    OR (@scope::text = 'history' AND (
      r.status = 'cancelled'
      OR (r.status = 'confirmed' AND r.end_date IS NOT NULL AND r.end_date < CURRENT_DATE)
    ))
  )
ORDER BY r.created_at DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountRequestsByUser :one
SELECT count(*) FROM request r
WHERE r.user_id = @user_id::int
  AND (
    @scope::text = 'all'
    OR (@scope::text = 'active' AND (
      r.status = 'in_progress'
      OR (r.status = 'confirmed' AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE))
    ))
    OR (@scope::text = 'history' AND (
      r.status = 'cancelled'
      OR (r.status = 'confirmed' AND r.end_date IS NOT NULL AND r.end_date < CURRENT_DATE)
    ))
  )
;

-- name: ListRequestsForOwner :many
SELECT
  r.id, COALESCE(r.house_id, 0)::int AS house_id, COALESCE(r.user_id, 0)::int AS user_id,
  COALESCE(r.guest_id, '')::text AS guest_id, COALESCE(r.email, '')::text AS email,
  r.name, r.surname, r.lastname, r.count, r.message, r.phone,
  r.start_date, r.end_date, r.status, r.created_at, r.updated_at,
  r.confirmed_at, r.rejection_reason,
  h.street AS house_street, h.house_number AS house_number,
  COALESCE(h.number_room, '')::text AS house_number_room,
  h.country AS house_city, h.price AS house_price, h.owner_id AS house_owner_id,
  COALESCE((SELECT f.path FROM file f WHERE f.house_id = h.id AND f.deleted = false ORDER BY f.position LIMIT 1), '')::text AS house_cover_path,
  -- guest profile from user table
  COALESCE(u.name, '')::text       AS guest_name,
  COALESCE(u.surname, '')::text    AS guest_surname,
  COALESCE(u.patronymic, '')::text AS guest_patronymic,
  COALESCE(u.avatar_url, '')::text AS guest_avatar_url,
  COALESCE(u.phone, '')::text      AS guest_phone_profile,
  COALESCE(u.is_verified, false)   AS guest_is_verified,
  COALESCE((
    SELECT round(avg(rv.rating)::numeric, 1)
    FROM review rv
    JOIN house hh ON hh.id = rv.house_id
    WHERE hh.owner_id = r.user_id AND rv.status = 'active'
  ), 0.0)::float8 AS guest_rating,
  (
    SELECT count(*)::int
    FROM review rv
    JOIN house hh ON hh.id = rv.house_id
    WHERE hh.owner_id = r.user_id AND rv.status = 'active'
  ) AS guest_reviews_count
FROM request r
JOIN house h ON h.id = r.house_id
LEFT JOIN "user" u ON u.id = r.user_id
WHERE h.owner_id = @owner_id
  AND r.status != 'pending_verification'
ORDER BY r.created_at DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountRequestsForOwner :one
SELECT count(*)
FROM request r
JOIN house h ON h.id = r.house_id
WHERE h.owner_id = @owner_id
  AND r.status != 'pending_verification';

-- name: ConfirmRequest :one
UPDATE request
SET status = 'confirmed', confirmed_at = now(), updated_at = now()
WHERE id = @id AND status = 'in_progress'
RETURNING
  id, COALESCE(house_id, 0)::int AS house_id, COALESCE(user_id, 0)::int AS user_id,
  COALESCE(guest_id, '')::text AS guest_id, COALESCE(email, '')::text AS email,
  name, surname, lastname, count, message, phone, start_date, end_date, status,
  created_at, updated_at, confirmed_at, rejection_reason;

-- name: RejectRequest :one
UPDATE request
SET status = 'cancelled', rejection_reason = sqlc.narg('rejection_reason'), updated_at = now()
WHERE id = @id AND status = 'in_progress'
RETURNING
  id, COALESCE(house_id, 0)::int AS house_id, COALESCE(user_id, 0)::int AS user_id,
  COALESCE(guest_id, '')::text AS guest_id, COALESCE(email, '')::text AS email,
  name, surname, lastname, count, message, phone, start_date, end_date, status,
  created_at, updated_at, confirmed_at, rejection_reason;

-- name: CancelRequest :one
UPDATE request
SET status = 'cancelled', updated_at = now()
WHERE id = @id
RETURNING
  id, COALESCE(house_id, 0)::int AS house_id, COALESCE(user_id, 0)::int AS user_id,
  COALESCE(guest_id, '')::text AS guest_id, COALESCE(email, '')::text AS email,
  name, surname, lastname, count, message, phone, start_date, end_date, status,
  created_at, updated_at, confirmed_at, rejection_reason;

-- name: HouseHasConfirmedOverlap :one
-- Reports whether the house already has a confirmed or active request overlapping
-- the requested [range_start, range_end) date range (half-open: end_date = checkout,
-- free for next guest). The caller passes the exclusive end (start+1 for single night).
SELECT EXISTS (
  SELECT 1
  FROM request rq
  WHERE rq.house_id = @house_id::int
    AND rq.status IN ('confirmed', 'active')
    AND rq.start_date < @range_end::date
    AND COALESCE(rq.end_date, rq.start_date + 1) > @range_start::date
) AS has_overlap;

-- name: ListBlockingRangesForHouse :many
-- All active/pending date ranges for a house so the booking calendar can
-- distinguish BLOCK ranges (confirmed, active) from WARN ranges (in_progress,
-- pending). Interval is half-open [start_date, end_date): end_date = checkout
-- day, free for same-day turnover. Past ranges are omitted.
SELECT start_date, end_date, status
FROM request
WHERE house_id = $1
  AND status IN ('confirmed', 'active', 'in_progress', 'pending')
  AND (end_date IS NULL OR end_date >= CURRENT_DATE)
ORDER BY start_date;

-- name: ListRequestsByGuest :many
SELECT
  r.id, COALESCE(r.house_id, 0)::int AS house_id, COALESCE(r.user_id, 0)::int AS user_id,
  COALESCE(r.guest_id, '')::text AS guest_id, COALESCE(r.email, '')::text AS email,
  r.name, r.surname, r.lastname, r.count, r.message, r.phone,
  r.start_date, r.end_date, r.status, r.created_at, r.updated_at,
  r.confirmed_at, r.rejection_reason,
  h.street AS house_street, h.house_number AS house_number,
  COALESCE(h.number_room, '')::text AS house_number_room,
  h.country AS house_city, h.price AS house_price, h.owner_id AS house_owner_id,
  COALESCE((SELECT f.path FROM file f WHERE f.house_id = h.id AND f.deleted = false ORDER BY f.position LIMIT 1), '')::text AS house_cover_path
FROM request r
JOIN house h ON h.id = r.house_id
WHERE r.guest_id = @guest_id::text
  AND (
    @scope::text = 'all'
    OR (@scope::text = 'active' AND (
      r.status = 'in_progress'
      OR r.status = 'pending_verification'
      OR (r.status = 'confirmed' AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE))
    ))
    OR (@scope::text = 'history' AND (
      r.status = 'cancelled'
      OR (r.status = 'confirmed' AND r.end_date IS NOT NULL AND r.end_date < CURRENT_DATE)
    ))
  )
ORDER BY r.created_at DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountRequestsByGuest :one
SELECT count(*) FROM request r
WHERE r.guest_id = @guest_id::text
  AND (
    @scope::text = 'all'
    OR (@scope::text = 'active' AND (
      r.status = 'in_progress'
      OR r.status = 'pending_verification'
      OR (r.status = 'confirmed' AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE))
    ))
    OR (@scope::text = 'history' AND (
      r.status = 'cancelled'
      OR (r.status = 'confirmed' AND r.end_date IS NOT NULL AND r.end_date < CURRENT_DATE)
    ))
  )
;

-- name: DeleteExpiredPendingRequests :exec
DELETE FROM request
WHERE status = 'pending_verification'
  AND created_at < @before::timestamp;

-- name: LinkGuestRequests :exec
UPDATE request
SET user_id = @user_id::int, status = 'in_progress', updated_at = now()
WHERE LOWER(TRIM(email)) = LOWER(TRIM(@email))
  AND user_id IS NULL
  AND status = 'pending_verification';
