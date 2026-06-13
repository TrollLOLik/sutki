-- Reverse of 000001_mobile_additions.up.sql (drops only what the up migration added).

DROP TABLE IF EXISTS payment;

DROP TABLE IF EXISTS message;
DROP TABLE IF EXISTS conversation_participant;
DROP TABLE IF EXISTS conversation;

DROP TABLE IF EXISTS device_token;

DROP TABLE IF EXISTS favorite;

DROP TABLE IF EXISTS refresh_token;

ALTER TABLE house DROP COLUMN IF EXISTS lat;
ALTER TABLE house DROP COLUMN IF EXISTS lng;

DROP INDEX IF EXISTS uniq_user_vk_id;
ALTER TABLE "user" DROP COLUMN IF EXISTS vk_id;
ALTER TABLE "user" DROP COLUMN IF EXISTS avatar_url;
