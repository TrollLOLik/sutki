-- Reviews need a timestamp so the mobile reviews list can sort and display
-- "когда" (e.g. "12 мая 2024"). The legacy `review` table has no time column;
-- this is an additive, idempotent change that backfills existing rows to now().
ALTER TABLE review ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
