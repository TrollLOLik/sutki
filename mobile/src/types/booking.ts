/**
 * Booking types mirror the backend DTOs (snake_case kept 1:1 with the wire
 * format). See backend/internal/delivery/http/booking_handler.go.
 */

/** Legacy `request.status` values used on mobile. */
export type BookingStatus = 'in_progress' | 'confirmed' | 'cancelled' | 'pending_verification';

/** Brief listing card embedded in booking list/detail responses. */
export interface BookingHouse {
  id: number;
  owner_id: number;
  address: string;
  city: string;
  /** Price per night, in rubles. */
  price: number;
  cover_url: string;
  owner_name?: string;
  owner_surname?: string;
  owner_patronymic?: string;
  owner_phone?: string;
  owner_avatar_url?: string;
  owner_rating?: number;
  owner_reviews_count?: number;
  owner_is_verified?: boolean;
}

/** Guest profile from the user table, available on the detail endpoint. */
export interface BookingGuest {
  name: string;
  surname: string;
  patronymic?: string;
  avatar_url: string;
  phone: string;
  is_verified: boolean;
  rating: number;
  reviews_count: number;
}

export interface Booking {
  id: number;
  house_id: number;
  user_id: number;
  name: string;
  surname: string;
  lastname: string;
  /** Number of guests. */
  count: number;
  message: string;
  phone: string;
  /** Check-in date, `YYYY-MM-DD`. */
  start_date: string;
  /** Check-out date, `YYYY-MM-DD`; null for open-ended legacy rows. */
  end_date: string | null;
  status: string;
  rejection_reason: string;
  /** RFC3339 timestamp set when an owner confirms; null otherwise. */
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  house?: BookingHouse;
  /** Guest profile from user table; only present on GET /requests/{id}. */
  guest?: BookingGuest;
}

export interface BookingsPage {
  items: Booking[];
  total: number;
  limit: number;
  offset: number;
}

/** Body of POST /api/v1/listings/{id}/requests. */
export interface CreateBookingBody {
  count: number;
  name: string;
  surname?: string;
  lastname?: string;
  phone: string;
  message?: string;
  /** `YYYY-MM-DD`. */
  start_date: string;
  /** `YYYY-MM-DD`; omit for an open-ended request. */
  end_date?: string;
  /** Guest email for OTP verification (guest-mode only). */
  email?: string;
}

