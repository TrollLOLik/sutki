-- name: HouseExists :one
SELECT EXISTS (
  SELECT 1 FROM house WHERE id = @id::int AND deleted = false
);

-- name: AddFavorite :exec
INSERT INTO favorite (user_id, house_id, created_at)
VALUES (@user_id::int, @house_id::int, now())
ON CONFLICT (user_id, house_id) DO NOTHING;

-- name: RemoveFavorite :exec
DELETE FROM favorite
WHERE user_id = @user_id::int AND house_id = @house_id::int;

-- name: ListFavoriteHouses :many
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
FROM favorite fav
JOIN house h ON h.id = fav.house_id
WHERE fav.user_id = @user_id::int
  AND h.deleted = false
  AND h.status = 'active'
ORDER BY fav.created_at DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountFavoriteHouses :one
SELECT count(*)
FROM favorite fav
JOIN house h ON h.id = fav.house_id
WHERE fav.user_id = @user_id::int
  AND h.deleted = false
  AND h.status = 'active';

-- name: ListFavoriteIDs :many
SELECT house_id
FROM favorite
WHERE user_id = @user_id::int
ORDER BY created_at DESC;
