-- Revert migration to add birthday column
ALTER TABLE "user" DROP COLUMN IF EXISTS birthday;
