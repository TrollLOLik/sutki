package poi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNearbyNormalizesAndSortsPOIs(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(r.Form.Get("data"), "around:1500") {
			t.Fatalf("missing nearby query: %s", r.Form.Get("data"))
		}
		_, _ = w.Write([]byte(`{"elements":[
			{"lat":55.7501,"lon":37.6101,"tags":{"name":"Кафе рядом","amenity":"cafe"}},
			{"lat":55.7600,"lon":37.6200,"tags":{"name":"Дальний парк","leisure":"park"}},
			{"lat":55.7501,"lon":37.6101,"tags":{"name":"Кафе рядом","amenity":"cafe"}}
		]}`))
	}))
	defer server.Close()

	client := NewOverpass(server.URL, time.Second)
	items, err := client.Nearby(context.Background(), 55.75, 37.61, 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 deduplicated POIs, got %d", len(items))
	}
	if items[0].Name != "Кафе рядом" || items[0].Type != "cafe" || items[0].Distance <= 0 {
		t.Fatalf("unexpected nearest POI: %+v", items[0])
	}
	if items[1].Type != "park" || items[1].Distance <= items[0].Distance {
		t.Fatalf("items are not sorted by distance: %+v", items)
	}
}

func TestWaitForTurnHonorsConfiguredInterval(t *testing.T) {
	client := NewOverpass("https://example.test", time.Second)
	client.minInterval = 25 * time.Millisecond

	if err := client.waitForTurn(context.Background()); err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	if err := client.waitForTurn(context.Background()); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(started); elapsed < 15*time.Millisecond {
		t.Fatalf("expected limiter delay, got %s", elapsed)
	}
}
