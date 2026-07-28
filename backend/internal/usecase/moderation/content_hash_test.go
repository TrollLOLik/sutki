package moderation

import (
	"strings"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestContentHashStorageShape(t *testing.T) {
	hash := ContentHash(domain.ModerationHouse{Description: "Уютная квартира"})
	if len(hash) != 129 || strings.Count(hash, ".") != 1 {
		t.Fatalf("ContentHash() shape = %q (len %d), want two 64-char hashes separated by a dot", hash, len(hash))
	}
}

func TestContentHashChangesForStructuredListingEdits(t *testing.T) {
	guests := int32(4)
	base := domain.ModerationHouse{
		City: "Москва", Street: "Ленина", HouseNumber: "10", NumberRoom: "5",
		Description: "Уютная квартира", Price: 2500, CountRoom: "2", Area: 45,
		MaxGuests: &guests, PetsAllowed: "allowed", ServicesList: "Wi-Fi",
		CategoriesList: "Квартира",
	}
	baseHash := ContentHash(base)

	tests := []struct {
		name   string
		mutate func(*domain.ModerationHouse)
	}{
		{name: "area", mutate: func(h *domain.ModerationHouse) { h.Area = 390_000 }},
		{name: "rooms", mutate: func(h *domain.ModerationHouse) { h.CountRoom = "3" }},
		{name: "guests", mutate: func(h *domain.ModerationHouse) { v := int32(8); h.MaxGuests = &v }},
		{name: "rules", mutate: func(h *domain.ModerationHouse) { h.PetsAllowed = "forbidden" }},
		{name: "services", mutate: func(h *domain.ModerationHouse) { h.ServicesList = "Wi-Fi, Парковка" }},
		{name: "category", mutate: func(h *domain.ModerationHouse) { h.CategoriesList = "Дом" }},
		{name: "apartment", mutate: func(h *domain.ModerationHouse) { h.NumberRoom = "7" }},
		{name: "photos", mutate: func(h *domain.ModerationHouse) { h.PhotoKeys = []string{"listings/1/new.webp"} }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			changed := base
			tt.mutate(&changed)
			if got := ContentHash(changed); got == baseHash {
				t.Fatalf("ContentHash() did not change after %s edit", tt.name)
			}
		})
	}
}

func TestPhotoRevisionDoesNotChangeTextHash(t *testing.T) {
	base := domain.ModerationHouse{Description: "Уютная квартира", PhotoKeys: []string{"listings/1/old.webp"}}
	changed := base
	changed.PhotoKeys = []string{"listings/1/new.webp"}
	if ContentHash(base) == ContentHash(changed) {
		t.Fatal("photo replacement must create a new moderation revision")
	}
	if textContentHash(base) != textContentHash(changed) {
		t.Fatal("photo replacement must not change duplicate-text identity")
	}
}
