DROP INDEX IF EXISTS idx_location_summary_due;
DROP TABLE IF EXISTS location_summary_job;
ALTER TABLE house DROP COLUMN IF EXISTS pois;
