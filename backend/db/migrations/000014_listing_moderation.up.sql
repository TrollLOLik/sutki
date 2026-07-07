-- Listing moderation: LLM verdict queue + audit trail, and photo perceptual
-- hashes for duplicate detection. House gains no new columns: the existing
-- status varchar and rejection_reason are reused.
--   house.status values after this migration:
--     'active'              — publicly visible (unchanged)
--     'pending_moderation'  — awaiting prefilter/LLM verdict, hidden
--     'moderation_review'   — needs a human decision, hidden
--     'rejected'            — moderation rejected, hidden, reason in rejection_reason
--     'new'                 — legacy default, treated as hidden (unchanged)

CREATE TABLE IF NOT EXISTS moderation_verdict (
  id bigserial PRIMARY KEY,
  house_id int NOT NULL REFERENCES house (id) ON DELETE CASCADE,
  -- sha256 of the moderated text bundle; dedups repeat LLM calls on
  -- unchanged content and lets updates carry verdicts over.
  content_hash varchar(64) NOT NULL,
  source varchar(16) NOT NULL,           -- prefilter | llm | human
  decision varchar(16),                  -- approve | reject | review (NULL until processed)
  category varchar(64),                  -- e.g. contacts, scam, prohibited, duplicate, stolen_photos, flagged_user
  reason varchar(2000),
  confidence real,
  raw_response jsonb,                    -- raw LLM output for audit
  moderator_id int REFERENCES "user" (id) ON DELETE SET NULL, -- set when source='human'
  -- queue machinery (mirrors email_outbox)
  status varchar(16) NOT NULL DEFAULT 'queued',  -- queued | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error varchar(2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One pending LLM job per house+content; re-submits of identical text no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_moderation_llm_content
  ON moderation_verdict (house_id, content_hash)
  WHERE source = 'llm';

-- Worker poll: due queued/processing jobs.
CREATE INDEX IF NOT EXISTS idx_moderation_due
  ON moderation_verdict (next_attempt_at)
  WHERE status IN ('queued', 'processing');

-- Human review queue + per-owner reject counting.
CREATE INDEX IF NOT EXISTS idx_moderation_house ON moderation_verdict (house_id, created_at DESC);

-- Perceptual hashes of listing photos for internal duplicate detection.
CREATE TABLE IF NOT EXISTS photo_hash (
  id bigserial PRIMARY KEY,
  house_id int NOT NULL REFERENCES house (id) ON DELETE CASCADE,
  media_key varchar(500) NOT NULL,
  phash bigint NOT NULL,                 -- 64-bit perceptual hash
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (house_id, media_key)
);

CREATE INDEX IF NOT EXISTS idx_photo_hash_phash ON photo_hash (phash);
