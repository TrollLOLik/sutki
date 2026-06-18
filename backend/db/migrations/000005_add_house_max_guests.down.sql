-- Revert max_guests column on house.
ALTER TABLE house DROP COLUMN IF EXISTS max_guests;
