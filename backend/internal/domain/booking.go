package domain

import "time"

// Booking statuses. These are stored in the legacy `request.status` varchar
// (no DB constraint); `confirmed` is a mobile addition to the legacy set.
const (
	BookingPending   = "in_progress"
	BookingConfirmed = "confirmed"
	BookingCancelled = "cancelled"
)

// Booking is a rental request. It maps onto the legacy `request` table.
// Nullable legacy columns are flattened to empty strings / nil pointers.
type Booking struct {
	ID              int32
	HouseID         int32
	UserID          int32
	Name            string
	Surname         string
	Lastname        string
	Count           int32
	Message         string
	Phone           string
	StartDate       time.Time
	EndDate         *time.Time
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	ConfirmedAt     *time.Time
	RejectionReason string

	// House is a lightweight summary of the booked listing, populated by
	// list/detail queries (nil for the create/transition results).
	House *BookingHouse

	// Guest is the renter's profile data from the user table.
	// Populated only on the detail query (GET /requests/{id}).
	Guest *BookingGuest
}

// BookingHouse is the listing summary attached to a booking.
type BookingHouse struct {
	ID          int32
	OwnerID     int32
	Street      string
	HouseNumber string
	City        string
	Price       int32
	CoverPath   string
}

// BookingGuest is the profile of the user who created the booking,
// fetched from the user table on the detail endpoint.
type BookingGuest struct {
	Name         string
	Surname      string
	AvatarURL    string
	Phone        string
	IsVerified   bool
	Rating       float64
	ReviewsCount int32
}

// NewBooking carries the validated fields needed to create a booking.
type NewBooking struct {
	HouseID   int32
	UserID    int32
	Name      string
	Surname   string
	Lastname  string
	Count     int32
	Message   string
	Phone     string
	StartDate time.Time
	EndDate   *time.Time
}
