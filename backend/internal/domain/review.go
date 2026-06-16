package domain

import "time"

// Review is a guest's rating + comment on a listing. It maps onto the legacy
// `review` table, whose `owner_id` column holds the review's author (the user
// who wrote it) and whose `house_id` points at the reviewed listing. The
// `created_at` column is a mobile addition (see migration 000003).
type Review struct {
	ID              int32
	HouseID         int32
	AuthorID        int32
	AuthorName      string
	AuthorAvatarURL string
	Rating          int32
	Body            string
	CreatedAt       time.Time
}

// RatingSummary aggregates a listing's published reviews. Distribution is
// indexed by stars-1, so Distribution[0] is the number of 1-star reviews and
// Distribution[4] the number of 5-star reviews.
type RatingSummary struct {
	Average      float64
	Total        int32
	Distribution [5]int32
}

// NewReview carries the validated fields needed to create a review.
type NewReview struct {
	HouseID  int32
	AuthorID int32
	Rating   int32
	Body     string
}
