ALTER TABLE listing_view_event
  ADD COLUMN IF NOT EXISTS user_id integer REFERENCES "user" (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS listing_view_event_user_history_idx
  ON listing_view_event (user_id, created_at DESC, house_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listing_view_event_user_day_unique
  ON listing_view_event (house_id, user_id, viewed_on)
  WHERE user_id IS NOT NULL;
