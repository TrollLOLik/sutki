package domain

import (
	"context"
	"time"
)

// House is a rental listing. It maps onto the legacy `house` table; `City`
// comes from the legacy `country` column, and Lat/Lng are mobile additions.
type House struct {
	ID                 int32
	OwnerID            int32
	OwnerName          string
	OwnerSurname       string
	OwnerPatronymic    string
	OwnerPhone         string
	OwnerAvatarURL     string
	OwnerRating        float64
	OwnerReviewsCount  int32
	OwnerListingsCount int32
	OwnerIsVerified    bool
	Street             string
	HouseNumber        string
	Description        string
	Price              int32
	CountRoom          string
	NumberRoom         string
	Area               int32
	City               string
	Status             string
	// RejectionReason is set when Status == "rejected" (moderation outcome);
	// only exposed to the owner.
	RejectionReason *string
	// MaxGuests is the sleeping capacity; nil means unknown (legacy listings).
	MaxGuests          *int32
	Lat                *float64
	Lng                *float64
	QcGeo              *int32
	Views              int32
	CoverPath          string
	CheckInAfter       *string
	CheckOutBefore     *string
	SmokingAllowed     *string
	PetsAllowed        *string
	ChildrenAllowed    *string
	EventsAllowed      *string
	CreatedAt          time.Time
	UpdatedAt          time.Time
	PromotionTypes     []string
	PromotionExpiresAt *time.Time

	ReviewsSummary  *string
	LocationSummary *string
	POIs            []HousePOI

	// Rating is the average review score rounded to one decimal (0 when the
	// listing has no published reviews); ReviewsCount is the published count.
	Rating       float64
	ReviewsCount int32

	Photos     []Photo
	Services   []Ref
	Categories []Ref
}

// Photo is an image attached to a house (legacy `file` table).
type Photo struct {
	ID       int32
	Path     string
	Position int32
}

// Ref is a lightweight id/name pair (categories, services).
type Ref struct {
	ID   int32
	Name string
}

// NewHouse is the input for creating a listing. OwnerID is taken from the
// authenticated session, not the request body. ServiceIDs/CategoryIDs link the
// listing to the amenity/category catalogs. Lat/Lng are optional (map screen).
type NewHouse struct {
	OwnerID         int32
	Street          string
	HouseNumber     string
	Description     string
	Price           int32
	CountRoom       string
	NumberRoom      *string
	Area            int32
	City            string
	Lat             *float64
	Lng             *float64
	QcGeo           *int32
	MaxGuests       *int32
	ServiceIDs      []int32
	CategoryIDs     []int32
	CheckInAfter    *string
	CheckOutBefore  *string
	SmokingAllowed  *string
	PetsAllowed     *string
	ChildrenAllowed *string
	EventsAllowed   *string
	Photos          []string
	POIs            []HousePOI
}

// HousePOI represents a nearby Point of Interest.
type HousePOI struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Distance int32  `json:"distance"`
}

// NearbyPOIProvider resolves nearby infrastructure from exact coordinates.
// It is used only by the background location enrichment worker.
type NearbyPOIProvider interface {
	Nearby(ctx context.Context, lat, lng float64, limit int) ([]HousePOI, error)
}

// LocationSummaryJob represents a pending or failed location summary generation task.
type LocationSummaryJob struct {
	ID            int64
	HouseID       int32
	City          string
	Street        string
	POIs          []HousePOI
	Lat           *float64
	Lng           *float64
	Revision      int64
	Status        string
	Attempts      int32
	NextAttemptAt time.Time
	LastError     *string
}

// LocationSummaryRepository handles persistence of background location summary generation jobs.
type LocationSummaryRepository interface {
	Enqueue(ctx context.Context, houseID int32, city, street string, lat, lng *float64, pois []HousePOI) error
	DueBatch(ctx context.Context, limit int32) ([]LocationSummaryJob, error)
	SavePOIs(ctx context.Context, job LocationSummaryJob, pois []HousePOI) (bool, error)
	Complete(ctx context.Context, job LocationSummaryJob, pois []HousePOI, summary string) (bool, error)
	MarkRetry(ctx context.Context, id, revision int64, lastError string, nextAttemptAt time.Time) error
	MarkFailed(ctx context.Context, id, revision int64, lastError string) error
}
