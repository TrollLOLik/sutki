-- Spatial index for map bounding-box queries.
-- B-tree is sufficient for simple range scans on (lat, lng).
-- Upgrade to GiST/PostGIS if bbox queries become a bottleneck.
CREATE INDEX IF NOT EXISTS idx_house_coords
  ON house (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Track geocoding quality (DaData qc_geo: 0=exact, 1=near, 2=street, 3=city, 4=region, 5=not found)
ALTER TABLE house ADD COLUMN IF NOT EXISTS qc_geo integer;

