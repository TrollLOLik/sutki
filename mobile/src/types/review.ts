/**
 * Review types mirror the backend DTOs (snake_case kept 1:1 with the wire
 * format). See backend/internal/delivery/http/review_handler.go.
 */

export interface Review {
  id: number;
  /** 1..5 stars. */
  rating: number;
  body: string;
  author_name: string;
  /** Absolute avatar URL, or '' when the author has none. */
  author_avatar_url: string;
  /** RFC3339 timestamp. */
  created_at: string;
}

export interface ReviewSummary {
  /** Average score rounded to one decimal (0 when there are no reviews). */
  average: number;
  total: number;
  /** Count of reviews per star value, keyed by "1".."5". */
  distribution: Record<string, number>;
}

export interface ReviewsPage {
  summary: ReviewSummary;
  items: Review[];
  total: number;
  limit: number;
  offset: number;
}

/** Body of POST /api/v1/listings/{id}/reviews. */
export interface CreateReviewBody {
  rating: number;
  body: string;
}

export interface UserReview {
  id: number;
  rating: number;
  body: string;
  author_name?: string;
  author_avatar_url?: string;
  created_at: string;
  house_id: number;
  house_street: string;
  house_number: string;
  house_city: string;
  house_cover_url: string;
}

export interface UserReviewsPage {
  items: UserReview[];
  total: number;
  limit: number;
  offset: number;
}

