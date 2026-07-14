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
