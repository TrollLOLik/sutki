-- name: ListHousesFiltered :many
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
  h.lat,
  h.lng,
  h.views,
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
  );

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
  h.lat,
  h.lng,
  h.views,
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
  )::int AS reviews_count
FROM house h
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
