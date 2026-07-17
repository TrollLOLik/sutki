-- name: ListHousesFiltered :many
WITH filtered AS MATERIALIZED (
  SELECT h.* FROM house h
  WHERE h.deleted = false
    AND h.status = 'active'
    AND (cardinality(@house_ids::int[]) = 0 OR h.id = ANY(@house_ids::int[]))
    AND (sqlc.narg('owner_id')::int IS NULL OR h.owner_id = sqlc.narg('owner_id'))
    AND (sqlc.narg('query')::text IS NULL OR h.street ILIKE '%' || sqlc.narg('query') || '%' OR h.house_number ILIKE '%' || sqlc.narg('query') || '%' OR h.description ILIKE '%' || sqlc.narg('query') || '%' OR h.country ILIKE '%' || sqlc.narg('query') || '%')
    AND (sqlc.narg('city')::text IS NULL OR h.country = sqlc.narg('city'))
    AND (sqlc.narg('price_min')::int IS NULL OR h.price >= sqlc.narg('price_min'))
    AND (sqlc.narg('price_max')::int IS NULL OR h.price <= sqlc.narg('price_max'))
    AND (sqlc.narg('area_min')::int IS NULL OR h.area >= sqlc.narg('area_min'))
    AND (sqlc.narg('area_max')::int IS NULL OR h.area <= sqlc.narg('area_max'))
    AND ((cardinality(@rooms::int[]) = 0 AND sqlc.narg('rooms_min')::int IS NULL) OR (CASE WHEN h.count_room IN ('studio','0') THEN 0 WHEN h.count_room = '5+' THEN 5 WHEN h.count_room ~ '^[0-9]+$' THEN h.count_room::int END) = ANY(@rooms::int[]) OR (sqlc.narg('rooms_min')::int IS NOT NULL AND (CASE WHEN h.count_room IN ('studio','0') THEN 0 WHEN h.count_room = '5+' THEN 5 WHEN h.count_room ~ '^[0-9]+$' THEN h.count_room::int END) >= sqlc.narg('rooms_min')))
    AND (cardinality(@services::int[]) = 0 OR (SELECT count(DISTINCT hhs.service_id) FROM house_house_service hhs WHERE hhs.house_id = h.id AND hhs.service_id = ANY(@services::int[])) = cardinality(@services::int[]))
    AND (sqlc.narg('category')::int IS NULL OR EXISTS (SELECT 1 FROM house_house_category hhc WHERE hhc.house_id = h.id AND hhc.house_category_id = sqlc.narg('category')))
    AND (sqlc.narg('check_in')::date IS NULL OR sqlc.narg('check_out')::date IS NULL OR NOT EXISTS (SELECT 1 FROM request rq WHERE rq.house_id = h.id AND rq.status = 'confirmed' AND rq.start_date < sqlc.narg('check_out')::date AND COALESCE(rq.end_date, rq.start_date + 1) > sqlc.narg('check_in')::date))
    AND (sqlc.narg('guests')::int IS NULL OR h.max_guests IS NULL OR h.max_guests >= sqlc.narg('guests'))
    AND (sqlc.narg('smoking_allowed')::boolean IS NULL OR (sqlc.narg('smoking_allowed')::boolean = true AND h.smoking_allowed IN ('allowed', 'on_balcony')))
    AND (sqlc.narg('pets_allowed')::boolean IS NULL OR (sqlc.narg('pets_allowed')::boolean = true AND h.pets_allowed IN ('allowed', 'on_request')))
    AND (sqlc.narg('children_allowed')::boolean IS NULL OR (sqlc.narg('children_allowed')::boolean = true AND h.children_allowed IN ('allowed', 'on_request')))
    AND (sqlc.narg('events_allowed')::boolean IS NULL OR (sqlc.narg('events_allowed')::boolean = true AND h.events_allowed IN ('allowed', 'on_request')))
    AND (sqlc.narg('min_lat')::float8 IS NULL OR h.lat >= sqlc.narg('min_lat')::float8)
    AND (sqlc.narg('max_lat')::float8 IS NULL OR h.lat <= sqlc.narg('max_lat')::float8)
    AND (sqlc.narg('min_lng')::float8 IS NULL OR h.lng >= sqlc.narg('min_lng')::float8)
    AND (sqlc.narg('max_lng')::float8 IS NULL OR h.lng <= sqlc.narg('max_lng')::float8)
), promoted AS (
  SELECT f.id AS house_id, lp.activated_at
  FROM filtered f JOIN listing_promotion lp ON lp.house_id=f.id
  WHERE lp.type='boost' AND lp.status='active' AND lp.starts_at<=now() AND lp.expires_at>now()
  ORDER BY lp.activated_at DESC,lp.id
  LIMIT 2
), popularity AS (
  SELECT d.house_id,
         sum(CASE WHEN d.is_anomalous THEN LEAST(d.authenticated_views, 10) ELSE d.authenticated_views END)::bigint AS score
  FROM listing_view_daily d
  JOIN filtered f ON f.id=d.house_id
  WHERE @sort::text='popular'
    AND d.view_date >= ((now() AT TIME ZONE 'UTC')::date - 30)
    AND d.view_date < (now() AT TIME ZONE 'UTC')::date
  GROUP BY d.house_id
)
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
  COALESCE(promo.promotion_types,ARRAY[]::text[])::text[] AS promotion_types,
  COALESCE(promo.promotion_expires_at::text,'')::text AS promotion_expires_at,
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
FROM filtered h
LEFT JOIN promoted top_promo ON top_promo.house_id=h.id
LEFT JOIN popularity pop ON pop.house_id=h.id
LEFT JOIN LATERAL (
 SELECT array_agg(lp.type ORDER BY lp.type)::text[] AS promotion_types,max(lp.expires_at) AS promotion_expires_at
 FROM listing_promotion lp WHERE lp.house_id=h.id AND lp.status='active' AND lp.starts_at<=now() AND lp.expires_at>now()
) promo ON true
ORDER BY
  CASE WHEN @sort::text IN ('', 'newest', 'oldest', 'popular') THEN CASE WHEN top_promo.house_id IS NOT NULL THEN 0 ELSE 1 END ELSE 0 END,
  CASE WHEN @sort::text = 'price_asc' THEN h.price END ASC NULLS LAST,
  CASE WHEN @sort::text = 'price_desc' THEN h.price END DESC NULLS LAST,
  CASE WHEN @sort::text = 'oldest' THEN h.created_at END ASC NULLS LAST,
  CASE WHEN @sort::text = 'popular' THEN COALESCE(pop.score, 0) END DESC NULLS LAST,
  CASE WHEN @sort::text IN ('', 'newest', 'popular', 'price_asc', 'price_desc') THEN h.created_at END DESC NULLS LAST,
  CASE WHEN @sort::text = 'oldest' THEN h.id END ASC NULLS LAST,
  h.id DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: ListMapClusters :many
SELECT btrim(h.country)::text AS city,
       avg(h.lat)::double precision AS lat,
       avg(h.lng)::double precision AS lng,
       count(*)::integer AS listing_count
FROM house h
WHERE h.status = 'active'
  AND h.deleted = false
  AND h.lat IS NOT NULL
  AND h.lng IS NOT NULL
  AND btrim(h.country) <> ''
GROUP BY btrim(h.country)
ORDER BY listing_count DESC, city;

-- name: CountHousesFiltered :one
SELECT count(*)
FROM house h
WHERE h.deleted = false
  AND h.status = 'active'
  AND (
    cardinality(@house_ids::int[]) = 0
    OR h.id = ANY(@house_ids::int[])
  )
  AND (sqlc.narg('owner_id')::int IS NULL OR h.owner_id = sqlc.narg('owner_id'))
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
  AND (sqlc.narg('area_min')::int IS NULL OR h.area >= sqlc.narg('area_min'))
  AND (sqlc.narg('area_max')::int IS NULL OR h.area <= sqlc.narg('area_max'))
  AND (
    (cardinality(@rooms::int[]) = 0 AND sqlc.narg('rooms_min')::int IS NULL)
    OR (CASE WHEN h.count_room IN ('studio','0') THEN 0 WHEN h.count_room = '5+' THEN 5 WHEN h.count_room ~ '^[0-9]+$' THEN h.count_room::int END) = ANY(@rooms::int[])
    OR (
      sqlc.narg('rooms_min')::int IS NOT NULL
      AND (CASE WHEN h.count_room IN ('studio','0') THEN 0 WHEN h.count_room = '5+' THEN 5 WHEN h.count_room ~ '^[0-9]+$' THEN h.count_room::int END) >= sqlc.narg('rooms_min')
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
  AND (
    sqlc.narg('smoking_allowed')::boolean IS NULL
    OR (sqlc.narg('smoking_allowed')::boolean = true AND h.smoking_allowed IN ('allowed', 'on_balcony'))
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
  h.rejection_reason,
  h.max_guests,
  h.lat,
  h.lng,
  h.qc_geo,
  h.views,
  COALESCE((
    SELECT sum(d.authenticated_views + d.guest_views)
    FROM listing_view_daily d
    WHERE d.house_id=h.id
      AND d.view_date >= ((now() AT TIME ZONE 'UTC')::date - 29)
  ), 0)::int AS views_30d,
  h.check_in_after,
  h.check_out_before,
  h.smoking_allowed,
  h.pets_allowed,
  h.children_allowed,
  h.events_allowed,
  h.created_at,
  h.updated_at,
  COALESCE((SELECT array_agg(lp.type ORDER BY lp.type)::text[] FROM listing_promotion lp WHERE lp.house_id=h.id AND lp.status='active' AND lp.starts_at<=now() AND lp.expires_at>now()),ARRAY[]::text[])::text[] AS promotion_types,
  COALESCE((SELECT max(lp.expires_at)::text FROM listing_promotion lp WHERE lp.house_id=h.id AND lp.status='active' AND lp.starts_at<=now() AND lp.expires_at>now()),'')::text AS promotion_expires_at,
  h.reviews_summary,
  h.location_summary,
  COALESCE(h.pois, '[]'::jsonb) AS pois,
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
-- Creates a new listing owned by the given user. New listings start in
-- 'pending_moderation': the moderation pipeline (prefilter + LLM verdict)
-- flips them to 'active' / 'moderation_review' / 'rejected'.
INSERT INTO house (
  owner_id, street, house_number, description, price, count_room, number_room,
  area, country, status, deleted, pay, views, lat, lng, qc_geo, max_guests,
  check_in_after, check_out_before, smoking_allowed, pets_allowed, children_allowed, events_allowed,
  created_at, updated_at, pois
) VALUES (
  @owner_id, @street, @house_number, @description, @price, @count_room,
  sqlc.narg('number_room'), @area, @country, 'pending_moderation', false, false, 0,
  sqlc.narg('lat'), sqlc.narg('lng'), sqlc.narg('qc_geo'), sqlc.narg('max_guests'),
  sqlc.narg('check_in_after'), sqlc.narg('check_out_before'), sqlc.narg('smoking_allowed'),
  sqlc.narg('pets_allowed'), sqlc.narg('children_allowed'), sqlc.narg('events_allowed'),
  now(), now(), @pois
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
    updated_at = now(),
    pois = @pois
WHERE id = @id AND owner_id = @owner_id AND deleted = false;

-- name: TransitionHouseStatus :execrows
-- Atomic owner-facing publication transition. The expected source status in
-- the WHERE clause prevents concurrent requests from reviving/re-hiding a
-- listing after another lifecycle action has already won.
UPDATE house
SET status = @to_status,
    rejection_reason = NULL,
    updated_at = now()
WHERE id = @id
  AND owner_id = @owner_id
  AND deleted = false
  AND status = @from_status;

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
  h.rejection_reason,
  h.max_guests,
  h.lat,
  h.lng,
  h.qc_geo,
  h.views,
  COALESCE((
    SELECT sum(d.authenticated_views + d.guest_views)
    FROM listing_view_daily d
    WHERE d.house_id=h.id
      AND d.view_date >= ((now() AT TIME ZONE 'UTC')::date - 29)
  ), 0)::int AS views_30d,
  h.check_in_after,
  h.check_out_before,
  h.smoking_allowed,
  h.pets_allowed,
  h.children_allowed,
  h.events_allowed,
  h.created_at,
  COALESCE((SELECT array_agg(lp.type ORDER BY lp.type)::text[] FROM listing_promotion lp WHERE lp.house_id=h.id AND lp.status='active' AND lp.starts_at<=now() AND lp.expires_at>now()),ARRAY[]::text[])::text[] AS promotion_types,
  COALESCE((SELECT max(lp.expires_at)::text FROM listing_promotion lp WHERE lp.house_id=h.id AND lp.status='active' AND lp.starts_at<=now() AND lp.expires_at>now()),'')::text AS promotion_expires_at,
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

-- name: ListPublicListingMediaKeys :many
SELECT DISTINCT f.path
FROM file f
JOIN house h ON h.id = f.house_id
WHERE f.deleted = false
  AND h.deleted = false
  AND f.path <> ''
  AND f.path NOT LIKE 'http://%'
  AND f.path NOT LIKE 'https://%'
  AND f.path NOT LIKE '%upload_files/%'
ORDER BY f.path
LIMIT $1;

-- name: UserHasConfirmedBookingForHouse :one
-- Returns true if the given user has a confirmed or active booking for the house.
-- Used by the detail endpoint to decide whether to reveal exact coordinates.
SELECT EXISTS (
  SELECT 1 FROM request
  WHERE user_id = @user_id AND house_id = @house_id
    AND status IN ('confirmed', 'active')
)::boolean;

-- name: UpdateHouseReviewsSummary :exec
UPDATE house
SET reviews_summary = $2
WHERE id = $1;

-- name: UpdateHouseLocationSummary :exec
UPDATE house
SET location_summary = $2
WHERE id = $1;
