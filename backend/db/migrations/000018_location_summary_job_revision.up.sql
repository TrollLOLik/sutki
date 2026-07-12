-- Keep exactly one current enrichment job per house. Existing duplicate jobs
-- can be stale after an address change, so preserve the newest one only.
DELETE FROM location_summary_job older
USING location_summary_job newer
WHERE older.house_id = newer.house_id
  AND older.id < newer.id;

ALTER TABLE location_summary_job
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

ALTER TABLE location_summary_job
  ADD CONSTRAINT location_summary_job_house_id_key UNIQUE (house_id);
