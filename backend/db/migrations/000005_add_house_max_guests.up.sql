-- Add max_guests (sleeping capacity) to house. Nullable: legacy rows keep NULL
-- ("capacity unknown") and are not excluded by the guests filter.
ALTER TABLE house ADD COLUMN IF NOT EXISTS max_guests integer DEFAULT NULL;
