ALTER TABLE user_activity_event
  DROP CONSTRAINT IF EXISTS user_activity_event_scope_check;

ALTER TABLE user_activity_event
  ADD CONSTRAINT user_activity_event_scope_check
  CHECK (scope IN ('messages','bookings','incoming','listings','reviews'));

CREATE INDEX user_activity_event_timeline_idx
  ON user_activity_event (user_id, created_at DESC, id DESC);
