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
  /** Sleeping capacity; null when unknown (legacy listings). */
  max_guests: number | null;
  views: number;
  cover_url: string;
  /** Average review score (0 when there are no reviews). */
  rating: number;
  /** Number of published reviews. */
  reviews_count: number;
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
}

export interface ListingsPage {
  items: ListingCard[];
  total: number;
  limit: number;
  offset: number;
}
