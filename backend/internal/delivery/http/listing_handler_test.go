package http

import (
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestListingDetailDTOExposesOwnerEditFieldsOnlyToOwner(t *testing.T) {
	handler := &ListingHandler{}
	house := domain.House{
		ID:         7,
		CountRoom:  "2",
		Photos:     []domain.Photo{{ID: 11, Path: "listings/42/sealed-photo.jpg", Key: "listings/42/sealed-photo.jpg", Position: 0}},
		Services:   []domain.Ref{{ID: 3, Name: "Wi-Fi"}},
		Categories: []domain.Ref{{ID: 5, Name: "Квартира"}},
	}

	public := handler.detailDTO(house, false, false)
	if public.Photos[0].Key != "" {
		t.Fatalf("public detail exposed storage key %q", public.Photos[0].Key)
	}
	if len(public.ServiceIDs) != 0 || len(public.CategoryIDs) != 0 {
		t.Fatalf("public detail exposed owner relation IDs: services=%v categories=%v", public.ServiceIDs, public.CategoryIDs)
	}

	owner := handler.detailDTO(house, true, true)
	if owner.Photos[0].Key != "listings/42/sealed-photo.jpg" {
		t.Fatalf("owner detail key = %q", owner.Photos[0].Key)
	}
	if len(owner.ServiceIDs) != 1 || owner.ServiceIDs[0] != 3 {
		t.Fatalf("owner service IDs = %v", owner.ServiceIDs)
	}
	if len(owner.CategoryIDs) != 1 || owner.CategoryIDs[0] != 5 {
		t.Fatalf("owner category IDs = %v", owner.CategoryIDs)
	}
}
