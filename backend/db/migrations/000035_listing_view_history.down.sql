DROP INDEX IF EXISTS listing_view_event_user_history_idx;
DROP INDEX IF EXISTS listing_view_event_user_day_unique;

ALTER TABLE listing_view_event
  DROP COLUMN IF EXISTS user_id;
