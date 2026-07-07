DROP INDEX IF EXISTS uniq_message_booking_event;

-- Remove system messages before restoring NOT NULL on sender_id.
DELETE FROM message WHERE sender_id IS NULL;

ALTER TABLE message
    DROP COLUMN IF EXISTS payload,
    DROP COLUMN IF EXISTS kind,
    ALTER COLUMN sender_id SET NOT NULL;
