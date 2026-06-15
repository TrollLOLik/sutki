package domain

// ListSort selects the ordering of a listing search.
type ListSort string

const (
	// SortDefault keeps promoted (date_top) listings first, then newest.
	SortDefault   ListSort = ""
	SortPriceAsc  ListSort = "price_asc"
	SortPriceDesc ListSort = "price_desc"
	SortNewest    ListSort = "newest"
)

// ListFilter holds the optional search/filter criteria for active listings.
// Nil pointers and empty slices mean "no constraint" for that field.
type ListFilter struct {
	Query    *string
	City     *string
	PriceMin *int32
	PriceMax *int32
	// Rooms matches listings whose room count equals one of these values.
	Rooms []int32
	// RoomsMin matches listings with at least this many rooms. It is OR-combined
	// with Rooms so the UI can express buckets like "2" plus "3+".
	RoomsMin *int32
	// Services requires the listing to include every one of these service IDs.
	Services []int32
	// Category requires the listing to belong to this category ID.
	Category *int32
	Sort     ListSort
	Limit    int32
	Offset   int32
}
