package domain

import "time"

// House is a rental listing. It maps onto the legacy `house` table; `City`
// comes from the legacy `country` column, and Lat/Lng are mobile additions.
type House struct {
	ID          int32
	OwnerID     int32
	Street      string
	HouseNumber string
	Description string
	Price       int32
	CountRoom   string
	NumberRoom  string
	Area        int32
	City        string
	Status      string
	Lat         *float64
	Lng         *float64
	Views       int32
	CoverPath   string
	CreatedAt   time.Time
	UpdatedAt   time.Time

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
