ALTER TABLE review
  ADD COLUMN IF NOT EXISTS request_id integer REFERENCES request(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_body text,
  ADD COLUMN IF NOT EXISTS published_body text,
  ADD COLUMN IF NOT EXISTS content_hash varchar(64),
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE review
SET original_body = COALESCE(original_body, body),
    published_body = CASE
      WHEN status = 'active' THEN COALESCE(published_body, body)
      ELSE published_body
    END;

CREATE UNIQUE INDEX IF NOT EXISTS review_one_per_request
  ON review(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS review_author_status_idx ON review(owner_id,status,created_at DESC);

CREATE TABLE review_reply (
  id bigserial PRIMARY KEY,
  review_id integer NOT NULL UNIQUE REFERENCES review(id) ON DELETE CASCADE,
  owner_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  original_body text NOT NULL,
  published_body text,
  status varchar(32) NOT NULL DEFAULT 'pending_moderation'
    CHECK (status IN ('pending_moderation','active','rejected','moderation_review')),
  content_hash varchar(64) NOT NULL,
  rejection_reason varchar(500),
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review_moderation_job (
  id bigserial PRIMARY KEY,
  target_type varchar(16) NOT NULL CHECK (target_type IN ('review','reply')),
  target_id bigint NOT NULL,
  content_hash varchar(64) NOT NULL,
  detected_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  masked_body text,
  status varchar(16) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','done')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  decision varchar(32),
  category varchar(64),
  reason varchar(500),
  confidence real,
  raw_response jsonb,
  last_error varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_type,target_id,content_hash)
);
CREATE INDEX review_moderation_job_due_idx
  ON review_moderation_job(status,next_attempt_at,id);

CREATE TABLE review_summary_job (
  house_id integer PRIMARY KEY REFERENCES house(id) ON DELETE CASCADE,
  dirty_since timestamptz NOT NULL DEFAULT now(),
  run_after timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  status varchar(16) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing')),
  attempts integer NOT NULL DEFAULT 0,
  last_error varchar(1000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_summary_job_due_idx ON review_summary_job(status,run_after);
