-- name: ListHousesFiltered :many
SELECT
  h.id,
  h.owner_id,
  h.street,
  h.house_number,
  h.description,
  h.price,
  h.count_room,
  h.area,
  h.country,
  h.status,
  h.max_guests,
  h.lat,
  h.lng,
  h.qc_geo,
  h.views,
  h.check_in_after,
  h.check_out_before,
  h.smoking_allowed,
  h.pets_allowed,
  h.children_allowed,
  h.events_allowed,
  h.created_at,
  COALESCE((
    SELECT round(avg(rv.rating)::numeric, 1)
    FROM review rv
    WHERE rv.house_id = h.id AND rv.status = 'active'
  ), 0)::float8 AS rating,
  (
    SELECT count(*)
    FROM review rv
    WHERE rv.house_id = h.id AND rv.status = 'active'
  )::int AS reviews_count,
  COALESCE((
    SELECT f.path
    FROM file f
    WHERE f.house_id = h.id AND f.deleted = false
    ORDER BY f.position
    LIMIT 1
  ), '')::text AS cover_path
FROM house h
WHERE h.deleted = false
  AND h.status = 'active'
  AND (
    cardinality(@house_ids::int[]) = 0
    OR h.id = ANY(@house_ids::int[])
  )
  AND (
    sqlc.narg('query')::text IS NULL
    OR h.street ILIKE '%' || sqlc.narg('query') || '%'
    OR h.house_number ILIKE '%' || sqlc.narg('query') || '%'
    OR h.description ILIKE '%' || sqlc.narg('query') || '%'
    OR h.country ILIKE '%' || sqlc.narg('query') || '%'
  )
  AND (sqlc.narg('city')::text IS NULL OR h.country = sqlc.narg('city'))
  AND (sqlc.narg('price_min')::int IS NULL OR h.price >= sqlc.narg('price_min'))
  AND (sqlc.narg('price_max')::int IS NULL OR h.price <= sqlc.narg('price_max'))
  AND (
    (cardinality(@rooms::int[]) = 0 AND sqlc.narg('rooms_min')::int IS NULL)
    OR (CASE WHEN h.count_room ~ '^[0-9]+$' THEN h.count_room::int END) = ANY(@rooms::int[])
    OR (
      sqlc.narg('rooms_min')::int IS NOT NULL
      AND (CASE WHEN h.count_room ~ '^[0-9]+$' THEN h.count_room::int END) >= sqlc.narg('rooms_min')
    )
  )
  AND (
    cardinality(@services::int[]) = 0
    OR (
      SELECT count(DISTINCT hhs.service_id)
      FROM house_house_service hhs
      WHERE hhs.house_id = h.id AND hhs.service_id = ANY(@services::int[])
    ) = cardinality(@services::int[])
  )
  AND (
    sqlc.narg('category')::int IS NULL
    OR EXISTS (
      SELECT 1 FROM house_house_category hhc
      WHERE hhc.house_id = h.id AND hhc.house_category_id = sqlc.narg('category')
    )
  )
  AND (
    sqlc.narg('check_in')::date IS NULL
    OR sqlc.narg('check_out')::date IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM request rq
      WHERE rq.house_id = h.id
        AND rq.status = 'confirmed'
        AND rq.start_date < sqlc.narg('check_out')::date
        AND COALESCE(rq.end_date, rq.start_date + 1) > sqlc.narg('check_in')::date
    )
  )
  AND (
    sqlc.narg('guests')::int IS NULL
    OR h.max_guests IS NULL
    OR h.max_guests >= sqlc.narg('guests')
  )
  AND (sqlc.narg('pets_allowed')::boolean IS NULL OR (sqlc.narg('pets_allowed')::boolean = true AND h.pets_allowed IN ('allowed', 'on_request')))
  AND (sqlc.narg('children_allowed')::boolean IS NULL OR (sqlc.narg('children_allowed')::boolean = true AND h.children_allowed IN ('allowed', 'on_request')))
  AND (sqlc.narg('events_allowed')::boolean IS NULL OR (sqlc.narg('events_allowed')::boolean = true AND h.events_allowed IN ('allowed', 'on_request')))
  AND (sqlc.narg('min_lat')::float8 IS NULL OR h.lat >= sqlc.narg('min_lat')::float8)
  AND (sqlc.narg('max_lat')::float8 IS NULL OR h.lat <= sqlc.narg('max_lat')::float8)
  AND (sqlc.narg('min_lng')::float8 IS NULL OR h.lng >= sqlc.narg('min_lng')::float8)
  AND (sqlc.narg('max_lng')::float8 IS NULL OR h.lng <= sqlc.narg('max_lng')::float8)
ORDER BY
  CASE WHEN @sort::text = 'price_asc' THEN h.price END ASC NULLS LAST,
  CASE WHEN @sort::text = 'price_desc' THEN h.price END DESC NULLS LAST,
  CASE WHEN @sort::text = 'newest' THEN h.created_at END DESC NULLS LAST,
  h.date_top DESC NULLS LAST,
  h.created_at DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountHousesFiltered :one
SELECT count(*)
FROM house h
WHERE h.deleted = false
  AND h.status = 'active'
  AND (
    cardinality(@house_ids::int[]) = 0
    OR h.id = ANY(@house_ids::int[])
  )
  AND (
    sqlc.narg('query')::text IS NULL
    OR h.street ILIKE '%' || sqlc.narg('query') || '%'
    OR h.house_number ILIKE '%' || sqlc.narg('query') || '%'
    OR h.description ILIKE '%' || sqlc.narg('query') || '%'
    OR h.country ILIKE '%' || sqlc.narg('query') || '%'
  )
  AND (sqlc.narg('city')::text IS NULL OR h.country = sqlc.narg('city'))
  AND (sqlc.narg('price_min')::int IS NULL OR h.price >= sqlc.narg('price_min'))
  AND (sqlc.narg('price_max')::int IS NULL OR h.price <= sqlc.narg('price_max'))
  AND (
    (cardinality(@rooms::int[]) = 0 AND sqlc.narg('rooms_min')::int IS NULL)
    OR (CASE WHEN h.count_room ~ '^[0-9]+$' THEN h.count_room::int END) = ANY(@rooms::int[])
    OR (
      sqlc.narg('rooms_min')::int IS NOT NULL
      AND (CASE WHEN h.count_room ~ '^[0-9]+$' THEN h.count_room::int END) >= sqlc.narg('rooms_min')
    )
  )
  AND (
    cardinality(@services::int[]) = 0
    OR (
      SELECT count(DISTINCT hhs.service_id)
      FROM house_house_service hhs
      WHERE hhs.house_id = h.id AND hhs.service_id = ANY(@services::int[])
    ) = cardinality(@services::int[])
  )
  AND (
    sqlc.narg('category')::int IS NULL
    OR EXISTS (
      SELECT 1 FROM house_house_category hhc
      WHERE hhc.house_id = h.id AND hhc.house_category_id = sqlc.narg('category')
    )
  )
  AND (
    sqlc.narg('check_in')::date IS NULL
    OR sqlc.narg('check_out')::date IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM request rq
      WHERE rq.house_id = h.id
        AND rq.status = 'confirmed'
        AND rq.start_date < sqlc.narg('check_out')::date
        AND COALESCE(rq.end_date, rq.start_date + 1) > sqlc.narg('check_in')::date
    )
  )
  AND (
    sqlc.narg('guests')::int IS NULL
    OR h.max_guests IS NULL
    OR h.max_guests >= sqlc.narg('guests')
  )
  AND (sqlc.narg('pets_allowed')::boolean IS NULL OR (sqlc.narg('pets_allowed')::boolean = true AND h.pets_allowed IN ('allowed', 'on_request')))
  AND (sqlc.narg('children_allowed')::boolean IS NULL OR (sqlc.narg('children_allowed')::boolean = true AND h.children_allowed IN ('allowed', 'on_request')))
  AND (sqlc.narg('events_allowed')::boolean IS NULL OR (sqlc.narg('events_allowed')::boolean = true AND h.events_allowed IN ('allowed', 'on_request')))
  AND (sqlc.narg('min_lat')::float8 IS NULL OR h.lat >= sqlc.narg('min_lat')::float8)
  AND (sqlc.narg('max_lat')::float8 IS NULL OR h.lat <= sqlc.narg('max_lat')::float8)
  AND (sqlc.narg('min_lng')::float8 IS NULL OR h.lng >= sqlc.narg('min_lng')::float8)
  AND (sqlc.narg('max_lng')::float8 IS NULL OR h.lng <= sqlc.narg('max_lng')::float8);

-- name: GetHouseByID :one
SELECT
  h.id,
  h.owner_id,
  h.street,
  h.house_number,
  h.description,
  h.price,
  h.count_room,
  h.number_room,
  h.area,
  h.country,
  h.status,
  h.max_guests,
  h.lat,
  h.lng,
  h.qc_geo,
  h.views,
  h.check_in_after,
  h.check_out_before,
  h.smoking_allowed,
  h.pets_allowed,
  h.children_allowed,
  h.events_allowed,
  h.created_at,
  h.updated_at,
  COALESCE((
    SELECT round(avg(rv.rating)::numeric, 1)
    FROM review rv
    WHERE rv.house_id = h.id AND rv.status = 'active'
  ), 0)::float8 AS rating,
  (
    SELECT count(*)
    FROM review rv
    WHERE rv.house_id = h.id AND rv.status = 'active'
  )::int AS reviews_count,
  u.name AS owner_name,
  u.surname AS owner_surname,
  u.patronymic AS owner_patronymic,
  u.phone AS owner_phone,
  u.avatar_url AS owner_avatar_url,
  u.is_verified AS owner_is_verified,
  COALESCE((
    SELECT round(avg(rv.rating)::numeric, 1)
    FROM review rv
    JOIN house owner_h ON owner_h.id = rv.house_id
    WHERE owner_h.owner_id = h.owner_id AND rv.status = 'active'
  ), 0.0)::float8 AS owner_rating,
  COALESCE((
    SELECT count(*)::int
    FROM review rv
    JOIN house owner_h ON owner_h.id = rv.house_id
    WHERE owner_h.owner_id = h.owner_id AND rv.status = 'active'
  ), 0)::int AS owner_reviews_count,
  COALESCE((
    SELECT count(*)::int
    FROM house owner_h
    WHERE owner_h.owner_id = h.owner_id AND owner_h.deleted = false
  ), 0)::int AS owner_listings_count
FROM house h
JOIN "user" u ON h.owner_id = u.id
WHERE h.id = $1 AND h.deleted = false;

-- name: ListHousePhotos :many
SELECT id, house_id, path, position
FROM file
WHERE house_id = $1 AND deleted = false
ORDER BY position;

-- name: ListHouseServices :many
SELECT s.id, s.name
FROM service s
JOIN house_house_service hhs ON hhs.service_id = s.id
WHERE hhs.house_id = $1 AND s.deleted = false
ORDER BY s.name;

-- name: ListHouseCategories :many
SELECT c.id, c.name
FROM house_category c
JOIN house_house_category hhc ON hhc.house_category_id = c.id
WHERE hhc.house_id = $1 AND c.deleted = false
ORDER BY c.name;

-- name: ListAllServices :many
SELECT id, name
FROM service
WHERE deleted = false
ORDER BY name;

-- name: ListAllCategories :many
SELECT id, name
FROM house_category
WHERE deleted = false
ORDER BY name;

-- name: CreateHouse :one
-- Creates a new listing owned by the given user. New listings are published
-- immediately (status='active') for the MVP; the one-time publication fee is a
-- front-end stub until YooKassa is wired (then `pay` flips via webhook).
INSERT INTO house (
  owner_id, street, house_number, description, price, count_room, number_room,
  area, country, status, deleted, pay, views, lat, lng, qc_geo, max_guests,
  check_in_after, check_out_before, smoking_allowed, pets_allowed, children_allowed, events_allowed,
  created_at, updated_at
) VALUES (
  @owner_id, @street, @house_number, @description, @price, @count_room,
  sqlc.narg('number_room'), @area, @country, 'active', false, false, 0,
  sqlc.narg('lat'), sqlc.narg('lng'), sqlc.narg('qc_geo'), sqlc.narg('max_guests'),
  sqlc.narg('check_in_after'), sqlc.narg('check_out_before'), sqlc.narg('smoking_allowed'),
  sqlc.narg('pets_allowed'), sqlc.narg('children_allowed'), sqlc.narg('events_allowed'),
  now(), now()
)
RETURNING id;

-- name: UpdateHouse :execrows
-- Updates a listing owned by the given user. Returns the number of affected
-- rows so the caller can distinguish "not found / not owner" (0) from success.
UPDATE house
SET street = @street,
    house_number = @house_number,
    description = @description,
    price = @price,
    count_room = @count_room,
    number_room = sqlc.narg('number_room'),
    area = @area,
    country = @country,
    lat = sqlc.narg('lat'),
    lng = sqlc.narg('lng'),
    qc_geo = sqlc.narg('qc_geo'),
    max_guests = sqlc.narg('max_guests'),
    check_in_after = sqlc.narg('check_in_after'),
    check_out_before = sqlc.narg('check_out_before'),
    smoking_allowed = sqlc.narg('smoking_allowed'),
    pets_allowed = sqlc.narg('pets_allowed'),
    children_allowed = sqlc.narg('children_allowed'),
    events_allowed = sqlc.narg('events_allowed'),
    updated_at = now()
WHERE id = @id AND owner_id = @owner_id AND deleted = false;

-- name: DeleteHouseServices :exec
DELETE FROM house_house_service WHERE house_id = $1;

-- name: DeleteHouseCategories :exec
DELETE FROM house_house_category WHERE house_id = $1;

-- name: AddHouseService :exec
INSERT INTO house_house_service (house_id, service_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: AddHouseCategory :exec
INSERT INTO house_house_category (house_id, house_category_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: ListHousesByOwner :many
SELECT
  h.id,
  h.street,
  h.house_number,
  h.description,
  h.price,
  h.count_room,
  h.area,
  h.country,
  h.status,
  h.max_guests,
  h.lat,
  h.lng,
  h.qc_geo,
  h.views,
  h.check_in_after,
  h.check_out_before,
  h.smoking_allowed,
  h.pets_allowed,
  h.children_allowed,
  h.events_allowed,
  h.created_at,
  COALESCE((
    SELECT round(avg(rv.rating)::numeric, 1)
    FROM review rv
    WHERE rv.house_id = h.id AND rv.status = 'active'
  ), 0)::float8 AS rating,
  (
    SELECT count(*)
    FROM review rv
    WHERE rv.house_id = h.id AND rv.status = 'active'
  )::int AS reviews_count,
  COALESCE((
    SELECT f.path
    FROM file f
    WHERE f.house_id = h.id AND f.deleted = false
    ORDER BY f.position
    LIMIT 1
  ), '')::text AS cover_path
FROM house h
WHERE h.owner_id = @owner_id AND h.deleted = false
ORDER BY h.created_at DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountHousesByOwner :one
SELECT count(*)
FROM house h
WHERE h.owner_id = @owner_id AND h.deleted = false;

-- name: AddHousePhoto :exec
INSERT INTO file (house_id, name, size, format, path, deleted, position, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, false, $6, now(), now());

-- name: SoftDeleteHousePhotos :exec
UPDATE file SET deleted = true, updated_at = now() WHERE house_id = $1;

-- name: UserHasConfirmedBookingForHouse :one
-- Returns true if the given user has a confirmed or active booking for the house.
-- Used by the detail endpoint to decide whether to reveal exact coordinates.
SELECT EXISTS (
  SELECT 1 FROM request
  WHERE user_id = @user_id AND house_id = @house_id
    AND status IN ('confirmed', 'active')
)::boolean;
