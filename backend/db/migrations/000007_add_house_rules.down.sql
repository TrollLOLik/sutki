-- Revert check-in / check-out times and rules enums from house table.
ALTER TABLE house DROP CONSTRAINT IF EXISTS chk_smoking;
ALTER TABLE house DROP CONSTRAINT IF EXISTS chk_pets;
ALTER TABLE house DROP CONSTRAINT IF EXISTS chk_children;
ALTER TABLE house DROP CONSTRAINT IF EXISTS chk_events;

ALTER TABLE house DROP COLUMN IF EXISTS check_in_after;
ALTER TABLE house DROP COLUMN IF EXISTS check_out_before;
ALTER TABLE house DROP COLUMN IF EXISTS smoking_allowed;
ALTER TABLE house DROP COLUMN IF EXISTS pets_allowed;
ALTER TABLE house DROP COLUMN IF EXISTS children_allowed;
ALTER TABLE house DROP COLUMN IF EXISTS events_allowed;
