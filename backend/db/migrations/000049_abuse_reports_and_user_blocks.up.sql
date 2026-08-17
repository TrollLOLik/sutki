CREATE TABLE abuse_report (
  id bigserial PRIMARY KEY,
  reporter_user_id integer REFERENCES "user"(id) ON DELETE SET NULL,
  reported_user_id integer REFERENCES "user"(id) ON DELETE SET NULL,
  target_type varchar(16) NOT NULL
    CHECK (target_type IN ('user', 'listing', 'message', 'review')),
  target_id bigint NOT NULL CHECK (target_id > 0),
  reason varchar(32) NOT NULL
    CHECK (reason IN (
      'spam',
      'fraud',
      'harassment',
      'inappropriate_content',
      'personal_data',
      'other'
    )),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status varchar(16) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'resolved', 'dismissed')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  source varchar(16) NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('android', 'ios', 'web', 'unknown')),
  app_version varchar(64),
  ip_address inet,
  user_agent varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX abuse_report_moderation_queue_idx
  ON abuse_report(status, created_at, id);

CREATE INDEX abuse_report_reporter_created_idx
  ON abuse_report(reporter_user_id, created_at DESC);

CREATE INDEX abuse_report_target_idx
  ON abuse_report(target_type, target_id, created_at DESC);

CREATE TABLE user_block (
  id bigserial PRIMARY KEY,
  blocker_user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  blocked_user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (blocker_user_id <> blocked_user_id),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE UNIQUE INDEX user_block_active_pair_idx
  ON user_block(blocker_user_id, blocked_user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX user_block_blocked_user_active_idx
  ON user_block(blocked_user_id, blocker_user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX user_block_blocker_history_idx
  ON user_block(blocker_user_id, created_at DESC, id DESC);
