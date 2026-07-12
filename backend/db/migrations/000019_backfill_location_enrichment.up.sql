-- Re-enrich existing houses whose legacy jobs completed with empty POIs or an
-- empty LLM response. Houses without exact coordinates are intentionally skipped.
INSERT INTO location_summary_job (
  house_id, city, street, lat, lng, pois, status, attempts, next_attempt_at, revision
)
SELECT
  h.id,
  h.country,
  h.street,
  h.lat,
  h.lng,
  COALESCE(h.pois, '[]'::jsonb),
  'queued',
  0,
  now(),
  1
FROM house h
WHERE h.deleted = false
  AND h.lat IS NOT NULL
  AND h.lng IS NOT NULL
  AND (
    h.location_summary IS NULL
    OR btrim(h.location_summary) = ''
    OR COALESCE(jsonb_array_length(h.pois), 0) = 0
  )
ON CONFLICT (house_id) DO UPDATE SET
  city = EXCLUDED.city,
  street = EXCLUDED.street,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  pois = EXCLUDED.pois,
  status = 'queued',
  attempts = 0,
  next_attempt_at = now(),
  last_error = NULL,
  revision = location_summary_job.revision + 1,
  updated_at = now();
