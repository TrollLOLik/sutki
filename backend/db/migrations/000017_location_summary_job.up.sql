-- Add POIs column to house table and create location_summary_job table.
ALTER TABLE house ADD COLUMN IF NOT EXISTS pois jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS location_summary_job (
  id bigserial PRIMARY KEY,
  house_id int NOT NULL REFERENCES house (id) ON DELETE CASCADE,
  city varchar(255) NOT NULL,
  street varchar(255) NOT NULL,
  pois jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(16) NOT NULL DEFAULT 'queued', -- queued | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error varchar(2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_summary_due
  ON location_summary_job (next_attempt_at)
  WHERE status IN ('queued', 'processing');
