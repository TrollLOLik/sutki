package http

import (
	"strings"
	"testing"
)

func TestValidateListingDescriptionRequestBoundsAllTextFields(t *testing.T) {
	req := ListingDescriptionRequest{
		City:             "  Москва  ",
		Street:           strings.Repeat("x", 201),
		DraftDescription: "draft",
	}
	if err := validateListingDescriptionRequest(&req); err == nil {
		t.Fatal("oversized street must be rejected")
	}

	req.Street = "Тверская"
	req.Amenities = make([]string, 41)
	if err := validateListingDescriptionRequest(&req); err == nil {
		t.Fatal("oversized amenities collection must be rejected")
	}
}

func TestValidateListingDescriptionRequestNormalizesStructuredText(t *testing.T) {
	req := ListingDescriptionRequest{
		City:       "  Москва ",
		Street:     " Тверская ",
		Amenities:  []string{" Wi-Fi "},
		HouseRules: []string{" Без курения "},
		POIs:       []poiDTO{{Name: " Парк ", Type: " leisure "}},
		Action:     "generate",
	}
	if err := validateListingDescriptionRequest(&req); err != nil {
		t.Fatalf("valid request rejected: %v", err)
	}
	if req.City != "Москва" || req.Street != "Тверская" ||
		req.Amenities[0] != "Wi-Fi" || req.HouseRules[0] != "Без курения" ||
		req.POIs[0].Name != "Парк" || req.POIs[0].Type != "leisure" {
		t.Fatalf("request was not normalized: %#v", req)
	}
}
