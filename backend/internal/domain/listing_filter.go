package domain

import "time"

// ListSort selects the ordering of a listing search.
type ListSort string

const (
	// SortDefault keeps promoted (date_top) listings first, then newest.
	SortDefault   ListSort = ""
	SortPriceAsc  ListSort = "price_asc"
	SortPriceDesc ListSort = "price_desc"
	SortNewest    ListSort = "newest"
	SortOldest    ListSort = "oldest"
	SortPopular   ListSort = "popular"
)

// ListFilter holds the optional search/filter criteria for active listings.
// Nil pointers and empty slices mean "no constraint" for that field.
type ListFilter struct {
	HouseIDs []int32
	OwnerID  *int32
	Query    *string
	City     *string
	PriceMin *int32
	PriceMax *int32
	AreaMin  *int32
	AreaMax  *int32
	// Rooms matches listings whose room count equals one of these values.
	Rooms []int32
	// RoomsMin matches listings with at least this many rooms. It is OR-combined
	// with Rooms so the UI can express buckets like "2" plus "3+".
	RoomsMin *int32
	// Services requires the listing to include every one of these service IDs.
	Services []int32
	// Category requires the listing to belong to this category ID.
	Category *int32
	// CheckIn/CheckOut, when both set, keep only listings that are free for the
	// whole [CheckIn, CheckOut) range — i.e. no confirmed booking overlaps it.
	// A nil on either side disables the availability constraint.
	CheckIn  *time.Time
	CheckOut *time.Time
	// Guests, when set, keeps listings whose max_guests is unknown (legacy rows)
	// or at least this large.
	Guests          *int32
	SmokingAllowed  *bool
	PetsAllowed     *bool
	ChildrenAllowed *bool
	EventsAllowed   *bool
	// BBox constrains results to listings whose coordinates fall inside the
	// given bounding box.  Used by the map-search tab.
	MinLat *float64
	MaxLat *float64
	MinLng *float64
	MaxLng *float64
	Sort   ListSort
	Limit  int32
	Offset int32
}

// MapCluster is a lightweight city-level aggregate used by the map when it is
// zoomed out too far to load individual listings.
type MapCluster struct {
	City  string  `json:"city"`
	Lat   float64 `json:"lat"`
	Lng   float64 `json:"lng"`
	Count int32   `json:"count"`
}
