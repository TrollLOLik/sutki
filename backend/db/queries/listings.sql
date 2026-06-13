-- name: ListActiveHouses :many
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
    SELECT f.path
    FROM file f
    WHERE f.house_id = h.id AND f.deleted = false
    ORDER BY f.position
    LIMIT 1
  ), '')::text AS cover_path
FROM house h
WHERE h.deleted = false AND h.status = 'active'
ORDER BY h.date_top DESC NULLS LAST, h.created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountActiveHouses :one
SELECT count(*) FROM house
WHERE deleted = false AND status = 'active';

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
  h.updated_at
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
