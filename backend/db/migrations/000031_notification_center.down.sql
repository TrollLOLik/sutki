DROP INDEX IF EXISTS user_activity_event_timeline_idx;

ALTER TABLE user_activity_event
  DROP CONSTRAINT IF EXISTS user_activity_event_scope_check;

DELETE FROM user_activity_event WHERE scope = 'messages';

ALTER TABLE user_activity_event
  ADD CONSTRAINT user_activity_event_scope_check
  CHECK (scope IN ('bookings','incoming','listings','reviews'));
