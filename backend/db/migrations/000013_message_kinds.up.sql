-- System chat messages (booking status cards). kind='user' for normal
-- messages, kind='booking_status' for server-posted booking event cards.
-- payload holds the machine-readable card data (request_id, event, dates...).
-- sender_id becomes nullable: system messages have no sender. body stays
-- NOT NULL and carries a human-readable fallback so old clients render
-- system cards as plain incoming text instead of breaking.
ALTER TABLE message
    ALTER COLUMN sender_id DROP NOT NULL,
    ADD COLUMN kind varchar(32) NOT NULL DEFAULT 'user',
    ADD COLUMN payload jsonb;

-- Dedup guard: at most one card per (conversation, request, event). Retries
-- and concurrent transitions cannot produce duplicate cards.
CREATE UNIQUE INDEX uniq_message_booking_event
    ON message (conversation_id, ((payload ->> 'request_id')), ((payload ->> 'event')))
    WHERE kind = 'booking_status';
