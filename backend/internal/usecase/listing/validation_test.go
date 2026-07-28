package listing

import (
	"errors"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func validListingInput() domain.NewHouse {
	guests := int32(4)
	return domain.NewHouse{
		OwnerID: 1, Street: "Ленина", HouseNumber: "10", City: "Москва",
		Description: "Уютная квартира рядом с метро", Price: 2500,
		CountRoom: "2", Area: 45, MaxGuests: &guests, CategoryIDs: []int32{1},
	}
}

func TestNormalizeAndValidateListingRejectsImpossibleStructuredValues(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*domain.NewHouse)
	}{
		{name: "huge area", mutate: func(h *domain.NewHouse) { h.Area = 390_000 }},
		{name: "tiny area", mutate: func(h *domain.NewHouse) { h.Area = 4 }},
		{name: "huge price", mutate: func(h *domain.NewHouse) { h.Price = 100_000_001 }},
		{name: "invalid room bucket", mutate: func(h *domain.NewHouse) { h.CountRoom = "99" }},
		{name: "no category", mutate: func(h *domain.NewHouse) { h.CategoryIDs = nil }},
		{name: "duplicate category", mutate: func(h *domain.NewHouse) { h.CategoryIDs = []int32{1, 1} }},
		{name: "too many guests", mutate: func(h *domain.NewHouse) { guests := int32(101); h.MaxGuests = &guests }},
		{name: "latitude without longitude", mutate: func(h *domain.NewHouse) { lat := 55.75; h.Lat = &lat }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := validListingInput()
			tt.mutate(&input)
			if err := normalizeAndValidateListing(&input); !errors.Is(err, ErrInvalidListing) {
				t.Fatalf("normalizeAndValidateListing() error = %v, want %v", err, ErrInvalidListing)
			}
		})
	}
}

func TestNormalizeAndValidateListingAcceptsBoundaryValues(t *testing.T) {
	input := validListingInput()
	input.Area = maxListingArea
	input.Price = maxListingPrice
	guests := maxListingGuests
	input.MaxGuests = &guests

	if err := normalizeAndValidateListing(&input); err != nil {
		t.Fatalf("normalizeAndValidateListing() error = %v", err)
	}
}

func TestNormalizeAndValidateListingNormalizesLegacyFivePlusRooms(t *testing.T) {
	input := validListingInput()
	input.CountRoom = "5+"

	if err := normalizeAndValidateListing(&input); err != nil {
		t.Fatalf("normalizeAndValidateListing() error = %v", err)
	}
	if input.CountRoom != "5" {
		t.Fatalf("CountRoom = %q, want canonical value 5", input.CountRoom)
	}
}
