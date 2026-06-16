-- name: ListReviewsByHouse :many
SELECT
  rv.id,
  rv.house_id,
  rv.owner_id AS author_id,
  rv.rating,
  rv.body,
  rv.created_at,
  COALESCE(NULLIF(TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')), ''), 'Гость')::text AS author_name,
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
  rv.body,
  rv.created_at,
  COALESCE(NULLIF(TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')), ''), 'Гость')::text AS author_name,
  COALESCE(u.avatar_url, '')::text AS author_avatar_url
FROM review rv
LEFT JOIN "user" u ON u.id = rv.owner_id
WHERE rv.id = @id::int;

-- name: CreateReview :one
INSERT INTO review (owner_id, house_id, body, rating, status, created_at)
VALUES (@owner_id::int, @house_id::int, @body, @rating::int, 'active', now())
RETURNING id;
