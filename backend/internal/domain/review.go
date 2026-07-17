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
	Status          string
	RejectionReason string
	RequestID       *int32
	CreatedAt       time.Time
	Reply           *ReviewReply

	// Optional house metadata, populated for my reviews pages
	HouseStreet    string
	HouseNumber    string
	HouseCity      string
	HouseCoverPath string
}

type ReviewReply struct {
	ID              int64
	ReviewID        int32
	OwnerID         int32
	Body            string
	Status          string
	RejectionReason string
	CreatedAt       time.Time
}

type ReviewEligibility struct {
	RequestID       int32     `json:"request_id"`
	HouseID         int32     `json:"house_id"`
	CanReview       bool      `json:"can_review"`
	ReviewDeadline  time.Time `json:"review_deadline"`
	ReviewID        *int32    `json:"review_id,omitempty"`
	ReviewStatus    string    `json:"review_status,omitempty"`
	ReviewRating    *int32    `json:"review_rating,omitempty"`
	ReviewBody      string    `json:"review_body,omitempty"`
	RejectionReason string    `json:"rejection_reason,omitempty"`
	EditAttempts    int32     `json:"edit_attempts,omitempty"`
	MaxAttempts     int32     `json:"max_attempts,omitempty"`
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
	RequestID int32
	HouseID   int32
	AuthorID  int32
	Rating    int32
	Body      string
}

type ReviewModerationJob struct {
	ID         int64
	TargetType string
	TargetID   int64
	Attempts   int32
}

type ReviewModerationTarget struct {
	TargetType     string
	TargetID       int64
	ReviewID       int32
	HouseID        int32
	AuthorID       int32
	ReviewAuthorID int32
	Rating         int32
	Body           string
	MaskedBody     string
	Categories     []string
}
