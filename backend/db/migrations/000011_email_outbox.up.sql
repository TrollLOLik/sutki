-- email_outbox is the persistent queue (transactional outbox) for all
-- application emails. Rows are the source of truth: the in-process worker
-- polls this table, so queued mail survives restarts/deploys and failed
-- sends are retried with backoff.
--
-- dedup_key is NULL for repeatable transactional mail (login codes) and a
-- unique event key (e.g. 'booking_confirmed:42') for one-shot notifications,
-- so a double Confirm click can never send two emails.
CREATE TABLE IF NOT EXISTS email_outbox (
  id BIGSERIAL PRIMARY KEY,
  dedup_key TEXT UNIQUE,
  user_id INTEGER,
  recipient TEXT NOT NULL,
  event_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  -- Bodies are nulled out after a successful send so plaintext login codes
  -- and personal data do not accumulate in the table.
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Partial index keeps the worker's poll query cheap regardless of history size.
CREATE INDEX IF NOT EXISTS email_outbox_pending_idx
  ON email_outbox (next_attempt_at)
  WHERE status = 'queued';

-- For pruning old delivered/failed rows.
CREATE INDEX IF NOT EXISTS email_outbox_created_at_idx
  ON email_outbox (created_at);
