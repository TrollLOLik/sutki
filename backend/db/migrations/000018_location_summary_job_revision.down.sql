ALTER TABLE location_summary_job DROP CONSTRAINT IF EXISTS location_summary_job_house_id_key;
ALTER TABLE location_summary_job DROP COLUMN IF EXISTS revision;
ALTER TABLE location_summary_job DROP COLUMN IF EXISTS lng;
ALTER TABLE location_summary_job DROP COLUMN IF EXISTS lat;
