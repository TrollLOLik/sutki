/**
 * Listing types mirror the backend DTOs (snake_case is kept on purpose so the
 * wire format maps 1:1 without a transform layer). See
 * backend/internal/delivery/http/listing_handler.go.
 */

export interface ListingRef {
  id: number;
  name: string;
}

export interface ListingPhoto {
  id: number;
  url: string;
  position: number;
}

export interface ListingPOI {
  name: string;
  type: string;
  distance: number;
}

export interface ListingCard {
  id: number;
  owner_id: number;
  address: string;
  city: string;
  description: string;
  /** Price per night, in rubles. */
  price: number;
  /** Number of rooms, as stored in the legacy schema (e.g. "2"). */
  rooms: string;
  /** Area in square meters. */
  area: number;
  lat: number | null;
  lng: number | null;
  /** Radius for coordinate fuzzing, in meters. 0 means exact coordinates. */
  radius: number;
  /** Geocoding quality code (DaData qc_geo): 0=exact, 1=near, 2=street, 3=city, 4=region, 5=not found. */
  qc_geo: number | null;
  /** Sleeping capacity; null when unknown (legacy listings). */
  max_guests: number | null;
  views: number;
  /** RFC3339 creation timestamp, used for deterministic owner sorting. */
  created_at: string;
  smoking_allowed?: 'allowed' | 'forbidden' | 'on_balcony' | null;
  pets_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  children_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  events_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  /** Owner-only rolling total returned by /listings/mine and own detail. */
  views_30d?: number;
  cover_url: string;
  /** Average review score (0 when there are no reviews). */
  rating: number;
  /** Number of published reviews. */
  reviews_count: number;
  promotion_types: Array<'boost' | 'highlight'>;
  promotion_expires_at?: string | null;
  /**
   * Moderation status — owner-only, populated exclusively by /listings/mine.
   * 'active' | 'unpublished' | 'pending_moderation' | 'moderation_review' | 'rejected'.
   * Absent in public list responses.
   */
  status?: string;
  /** Rejection reason shown to the owner when status === 'rejected'. */
  rejection_reason?: string | null;
}

export interface ListingDetail extends ListingCard {
  owner_id: number;
  owner_name: string;
  owner_surname: string;
  owner_patronymic: string;
  owner_phone: string;
  owner_avatar_url: string;
  owner_rating: number;
  owner_reviews_count: number;
  owner_listings_count: number;
  owner_is_verified: boolean;
  street?: string;
  house_number?: string;
  number_room: string;
  photos: ListingPhoto[];
  services: ListingRef[];
  categories: ListingRef[];
  check_in_after?: string | null;
  check_out_before?: string | null;
  smoking_allowed?: 'allowed' | 'forbidden' | 'on_balcony' | null;
  pets_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  children_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  events_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  reviews_summary?: string | null;
  location_summary?: string | null;
  pois?: ListingPOI[];
}

export interface ListingsPage {
  items: ListingCard[];
  total: number;
  limit: number;
  offset: number;
}
