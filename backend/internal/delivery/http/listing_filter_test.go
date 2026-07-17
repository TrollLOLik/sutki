package http

import (
	"net/url"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestParseListFilterSort(t *testing.T) {
	tests := []struct {
		query string
		want  domain.ListSort
	}{
		{"", domain.SortDefault},
		{"newest", domain.SortNewest},
		{"oldest", domain.SortOldest},
		{"popular", domain.SortPopular},
		{"price_asc", domain.SortPriceAsc},
		{"price_desc", domain.SortPriceDesc},
	}

	for _, tt := range tests {
		t.Run(string(tt.want), func(t *testing.T) {
			filter, message := parseListFilter(url.Values{"sort": []string{tt.query}})
			if message != "" {
				t.Fatalf("parseListFilter() message = %q", message)
			}
			if filter.Sort != tt.want {
				t.Fatalf("parseListFilter() sort = %q, want %q", filter.Sort, tt.want)
			}
		})
	}
}

func TestParseListFilterRejectsUnknownSort(t *testing.T) {
	_, message := parseListFilter(url.Values{"sort": []string{"recommended"}})
	if message != "invalid sort" {
		t.Fatalf("parseListFilter() message = %q, want invalid sort", message)
	}
}

func TestParseListFilterStructuredFields(t *testing.T) {
	filter, message := parseListFilter(url.Values{
		"owner_id":        []string{"42"},
		"category":        []string{"7"},
		"area_min":        []string{"30"},
		"area_max":        []string{"80"},
		"rooms":           []string{"0,1,4"},
		"rooms_min":       []string{"5"},
		"guests":          []string{"3"},
		"smoking_allowed": []string{"true"},
	})
	if message != "" {
		t.Fatalf("parseListFilter() message = %q", message)
	}
	if filter.OwnerID == nil || *filter.OwnerID != 42 || filter.Category == nil || *filter.Category != 7 {
		t.Fatalf("owner/category = %v/%v", filter.OwnerID, filter.Category)
	}
	if filter.AreaMin == nil || *filter.AreaMin != 30 || filter.AreaMax == nil || *filter.AreaMax != 80 {
		t.Fatalf("area range = %v/%v", filter.AreaMin, filter.AreaMax)
	}
	if filter.Guests == nil || *filter.Guests != 3 || filter.SmokingAllowed == nil || !*filter.SmokingAllowed {
		t.Fatalf("guests/smoking = %v/%v", filter.Guests, filter.SmokingAllowed)
	}
}

func TestParseListFilterRejectsInvertedArea(t *testing.T) {
	_, message := parseListFilter(url.Values{"area_min": []string{"80"}, "area_max": []string{"30"}})
	if message != "area_min must not exceed area_max" {
		t.Fatalf("parseListFilter() message = %q", message)
	}
}
