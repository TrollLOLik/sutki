-- Per-user opt-outs for non-transactional email categories.
-- Transactional mail (login codes, booking confirmed/rejected for the tenant)
-- is NOT gated by this table. A missing row means "all defaults".
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id     integer PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  -- Owner-side booking activity (new request, tenant cancelled).
  booking     boolean NOT NULL DEFAULT true,
  -- "New message while you were away" chat notifications.
  chat_digest boolean NOT NULL DEFAULT true,
  -- "You received a review" notifications (phase 3).
  reviews     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
