-- Add check-in / check-out times and rules enums to house table.
ALTER TABLE house ADD COLUMN IF NOT EXISTS check_in_after time DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS check_out_before time DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS smoking_allowed varchar(50) DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS pets_allowed varchar(50) DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS children_allowed varchar(50) DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS events_allowed varchar(50) DEFAULT NULL;

ALTER TABLE house ADD CONSTRAINT chk_smoking
  CHECK (smoking_allowed IS NULL OR smoking_allowed IN ('allowed', 'forbidden', 'on_balcony'));

ALTER TABLE house ADD CONSTRAINT chk_pets
  CHECK (pets_allowed IS NULL OR pets_allowed IN ('allowed', 'forbidden', 'on_request'));

ALTER TABLE house ADD CONSTRAINT chk_children
  CHECK (children_allowed IS NULL OR children_allowed IN ('allowed', 'forbidden', 'on_request'));

ALTER TABLE house ADD CONSTRAINT chk_events
  CHECK (events_allowed IS NULL OR events_allowed IN ('allowed', 'forbidden', 'on_request'));
