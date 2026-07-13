CREATE TABLE IF NOT EXISTS listing_view_event (
  event_id uuid PRIMARY KEY,
  house_id integer NOT NULL REFERENCES house(id) ON DELETE CASCADE,
  viewer_hash bytea NOT NULL,
  viewer_kind varchar(16) NOT NULL CHECK (viewer_kind IN ('authenticated', 'guest')),
  viewed_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_view_event_viewer_day_unique UNIQUE (house_id, viewer_hash, viewed_on)
);

CREATE INDEX IF NOT EXISTS listing_view_event_created_at_idx
  ON listing_view_event (created_at);

CREATE TABLE IF NOT EXISTS listing_view_daily (
  house_id integer NOT NULL REFERENCES house(id) ON DELETE CASCADE,
  view_date date NOT NULL,
  authenticated_views integer NOT NULL DEFAULT 0 CHECK (authenticated_views >= 0),
  guest_views integer NOT NULL DEFAULT 0 CHECK (guest_views >= 0),
  is_anomalous boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (house_id, view_date)
);

CREATE INDEX IF NOT EXISTS listing_view_daily_date_house_idx
  ON listing_view_daily (view_date, house_id)
  INCLUDE (authenticated_views, guest_views, is_anomalous);

CREATE INDEX IF NOT EXISTS house_active_created_at_idx
  ON house (created_at DESC, id DESC)
  WHERE deleted = false AND status = 'active';

CREATE INDEX IF NOT EXISTS house_active_views_idx
  ON house (views DESC, created_at DESC, id DESC)
  WHERE deleted = false AND status = 'active';

