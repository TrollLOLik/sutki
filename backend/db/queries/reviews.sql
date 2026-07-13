-- name: ListReviewsByHouse :many
SELECT
  rv.id,
  rv.house_id,
  rv.owner_id AS author_id,
  rv.rating,
  COALESCE(rv.published_body, rv.body)::text AS body,
  rv.created_at,
  COALESCE(NULLIF(TRIM(concat_ws(' ', NULLIF(u.name, ''), NULLIF(u.patronymic, ''), NULLIF(u.surname, ''))), ''), 'Гость')::text AS author_name,
  COALESCE(u.avatar_url, '')::text AS author_avatar_url
FROM review rv
LEFT JOIN "user" u ON u.id = rv.owner_id
WHERE rv.house_id = @house_id::int
  AND rv.status = 'active'
ORDER BY rv.created_at DESC, rv.id DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountReviewsByHouse :one
SELECT count(*)
FROM review
WHERE house_id = @house_id::int
  AND status = 'active';

-- name: ReviewSummaryByHouse :one
SELECT
  COALESCE(round(avg(rating)::numeric, 1), 0)::float8 AS average,
  (count(*))::int AS total,
  (count(*) FILTER (WHERE rating = 1))::int AS count1,
  (count(*) FILTER (WHERE rating = 2))::int AS count2,
  (count(*) FILTER (WHERE rating = 3))::int AS count3,
  (count(*) FILTER (WHERE rating = 4))::int AS count4,
  (count(*) FILTER (WHERE rating = 5))::int AS count5
FROM review
WHERE house_id = @house_id::int
  AND status = 'active';

-- name: GetReviewByID :one
SELECT
  rv.id,
  rv.house_id,
  rv.owner_id AS author_id,
  rv.rating,
  COALESCE(rv.original_body, rv.body)::text AS body,
  rv.status,
  COALESCE(rv.rejection_reason, '')::text AS rejection_reason,
  rv.request_id,
  rv.created_at,
  COALESCE(NULLIF(TRIM(concat_ws(' ', NULLIF(u.name, ''), NULLIF(u.patronymic, ''), NULLIF(u.surname, ''))), ''), 'Гость')::text AS author_name,
  COALESCE(u.avatar_url, '')::text AS author_avatar_url
FROM review rv
LEFT JOIN "user" u ON u.id = rv.owner_id
WHERE rv.id = @id::int;

-- name: CreateReview :one
INSERT INTO review (owner_id, house_id, body, rating, status, created_at)
VALUES (@owner_id::int, @house_id::int, @body, @rating::int, 'pending_moderation', now())
RETURNING id;

-- name: ListReviewsByAuthor :many
SELECT
  rv.id,
  rv.house_id,
  rv.owner_id AS author_id,
  rv.rating,
  COALESCE(rv.original_body, rv.body)::text AS body,
  rv.status,
  COALESCE(rv.rejection_reason, '')::text AS rejection_reason,
  rv.request_id,
  rv.created_at,
  h.street AS house_street,
  h.house_number AS house_number,
  h.country AS house_city,
  COALESCE((SELECT f.path FROM file f WHERE f.house_id = h.id AND f.deleted = false ORDER BY f.position LIMIT 1), '')::text AS house_cover_path
FROM review rv
JOIN house h ON h.id = rv.house_id
WHERE rv.owner_id = $1
ORDER BY rv.created_at DESC, rv.id DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountReviewsByAuthor :one
SELECT count(*)
FROM review
WHERE owner_id = $1;

-- name: ListReviewsForHost :many
SELECT
  rv.id,
  rv.house_id,
  rv.owner_id AS author_id,
  rv.rating,
  COALESCE(rv.published_body, rv.body)::text AS body,
  rv.created_at,
  h.street AS house_street,
  h.house_number AS house_number,
  h.country AS house_city,
  COALESCE(NULLIF(TRIM(concat_ws(' ', NULLIF(u.name, ''), NULLIF(u.patronymic, ''), NULLIF(u.surname, ''))), ''), 'Гость')::text AS author_name,
  COALESCE(u.avatar_url, '')::text AS author_avatar_url,
  COALESCE((SELECT f.path FROM file f WHERE f.house_id = h.id AND f.deleted = false ORDER BY f.position LIMIT 1), '')::text AS house_cover_path
FROM review rv
JOIN house h ON h.id = rv.house_id
LEFT JOIN "user" u ON u.id = rv.owner_id
WHERE h.owner_id = $1 AND rv.status = 'active'
ORDER BY rv.created_at DESC, rv.id DESC
LIMIT @result_limit OFFSET @result_offset;

-- name: CountReviewsForHost :one
SELECT count(*)
FROM review rv
JOIN house h ON h.id = rv.house_id
WHERE h.owner_id = $1 AND rv.status = 'active';

-- name: ReviewSummaryForHost :one
SELECT
  COALESCE(round(avg(rv.rating)::numeric, 1), 0)::float8 AS average,
  (count(*))::int AS total,
  (count(*) FILTER (WHERE rv.rating = 1))::int AS count1,
  (count(*) FILTER (WHERE rv.rating = 2))::int AS count2,
  (count(*) FILTER (WHERE rv.rating = 3))::int AS count3,
  (count(*) FILTER (WHERE rv.rating = 4))::int AS count4,
  (count(*) FILTER (WHERE rv.rating = 5))::int AS count5
FROM review rv
JOIN house h ON h.id = rv.house_id
WHERE h.owner_id = @owner_id::int
  AND rv.status = 'active';


