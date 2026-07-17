CREATE TABLE user_activity_event (
  id bigserial PRIMARY KEY,
  event_key varchar(160) NOT NULL,
  user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  scope varchar(32) NOT NULL CHECK (scope IN ('bookings','incoming','listings','reviews')),
  event_type varchar(64) NOT NULL,
  entity_id bigint,
  action varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  UNIQUE (user_id, event_key)
);

CREATE INDEX user_activity_event_unseen_idx
  ON user_activity_event (user_id, scope, created_at DESC)
  WHERE seen_at IS NULL;
