package poi

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	searchRadiusMeters = 1500
	defaultMinInterval = 5 * time.Second
)

type Overpass struct {
	endpoint   string
	httpClient *http.Client

	mu            sync.Mutex
	nextRequestAt time.Time
	minInterval   time.Duration
}

func NewOverpass(endpoint string, timeout time.Duration) *Overpass {
	if endpoint == "" {
		endpoint = "https://overpass-api.de/api/interpreter"
	}
	if timeout <= 0 {
		timeout = 12 * time.Second
	}
	return &Overpass{
		endpoint:    endpoint,
		httpClient:  &http.Client{Timeout: timeout},
		minInterval: defaultMinInterval,
	}
}

type overpassResponse struct {
	Elements []struct {
		Lat    float64 `json:"lat"`
		Lon    float64 `json:"lon"`
		Center *struct {
			Lat float64 `json:"lat"`
			Lon float64 `json:"lon"`
		} `json:"center"`
		Tags map[string]string `json:"tags"`
	} `json:"elements"`
}

func (o *Overpass) Nearby(ctx context.Context, lat, lng float64, limit int) ([]domain.HousePOI, error) {
	if limit <= 0 {
		limit = 8
	}
	query := fmt.Sprintf(`[out:json][timeout:10];(
nwr(around:%d,%.6f,%.6f)["amenity"~"^(cafe|restaurant|fast_food|hospital|pharmacy|school|kindergarten|bus_station)$"]["name"];
nwr(around:%d,%.6f,%.6f)["shop"]["name"];
nwr(around:%d,%.6f,%.6f)["leisure"="park"]["name"];
nwr(around:%d,%.6f,%.6f)["railway"~"^(station|halt|subway_entrance)$"]["name"];
nwr(around:%d,%.6f,%.6f)["public_transport"~"^(station|platform)$"]["name"];
nwr(around:%d,%.6f,%.6f)["tourism"~"^(attraction|museum)$"]["name"];
);out center 120;`, searchRadiusMeters, lat, lng, searchRadiusMeters, lat, lng,
		searchRadiusMeters, lat, lng, searchRadiusMeters, lat, lng,
		searchRadiusMeters, lat, lng, searchRadiusMeters, lat, lng)

	form := url.Values{"data": {query}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create overpass request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "sutkiru-location-enrichment/1.0")
	if err := o.waitForTurn(ctx); err != nil {
		return nil, fmt.Errorf("wait for overpass rate limit: %w", err)
	}
	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("overpass request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("overpass status: %d", resp.StatusCode)
	}
	var decoded overpassResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, fmt.Errorf("decode overpass response: %w", err)
	}

	items := make([]domain.HousePOI, 0, len(decoded.Elements))
	seen := make(map[string]struct{})
	for _, element := range decoded.Elements {
		name := strings.TrimSpace(element.Tags["name"])
		if name == "" {
			continue
		}
		pointLat, pointLng := element.Lat, element.Lon
		if element.Center != nil {
			pointLat, pointLng = element.Center.Lat, element.Center.Lon
		}
		if pointLat == 0 && pointLng == 0 {
			continue
		}
		kind := classify(element.Tags)
		key := strings.ToLower(name) + "|" + kind
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		items = append(items, domain.HousePOI{Name: name, Type: kind, Distance: int32(math.Round(haversine(lat, lng, pointLat, pointLng)))})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Distance < items[j].Distance })
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

// waitForTurn serializes requests across the worker so a large backfill does
// not immediately exceed the shared public Overpass instance's rate limit.
func (o *Overpass) waitForTurn(ctx context.Context) error {
	o.mu.Lock()
	now := time.Now()
	requestAt := o.nextRequestAt
	if requestAt.Before(now) {
		requestAt = now
	}
	o.nextRequestAt = requestAt.Add(o.minInterval)
	o.mu.Unlock()

	delay := time.Until(requestAt)
	if delay <= 0 {
		return nil
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func classify(tags map[string]string) string {
	if tags["railway"] == "subway_entrance" {
		return "subway"
	}
	if tags["railway"] != "" || tags["public_transport"] != "" || tags["amenity"] == "bus_station" {
		return "station"
	}
	if tags["leisure"] == "park" {
		return "park"
	}
	if tags["shop"] != "" || tags["amenity"] == "pharmacy" {
		return "shop"
	}
	switch tags["amenity"] {
	case "cafe", "restaurant", "fast_food":
		return "cafe"
	default:
		return "landmark"
	}
}

func haversine(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371000.0
	toRadians := math.Pi / 180
	dLat := (lat2 - lat1) * toRadians
	dLng := (lng2 - lng1) * toRadians
	a := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(lat1*toRadians)*math.Cos(lat2*toRadians)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return earthRadius * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}
