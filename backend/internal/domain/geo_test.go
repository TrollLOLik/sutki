package domain

import (
	"math"
	"testing"
)

// haversineMeters returns the great-circle distance between two points in meters.
func haversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6_371_000.0 // Earth radius in meters
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func TestFuzzCoordinates_Deterministic(t *testing.T) {
	lat, lng := 55.751244, 37.618423 // Moscow
	var houseID int32 = 42

	fLat1, fLng1 := FuzzCoordinates(lat, lng, houseID)
	fLat2, fLng2 := FuzzCoordinates(lat, lng, houseID)

	if fLat1 != fLat2 || fLng1 != fLng2 {
		t.Errorf("FuzzCoordinates is not deterministic: (%f,%f) vs (%f,%f)", fLat1, fLng1, fLat2, fLng2)
	}
}

func TestFuzzCoordinates_DifferentIDs(t *testing.T) {
	lat, lng := 55.751244, 37.618423

	fLat1, fLng1 := FuzzCoordinates(lat, lng, 1)
	fLat2, fLng2 := FuzzCoordinates(lat, lng, 2)

	if fLat1 == fLat2 && fLng1 == fLng2 {
		t.Error("FuzzCoordinates produced identical results for different house IDs")
	}
}

func TestFuzzCoordinates_OffsetWithinBounds(t *testing.T) {
	testCases := []struct {
		name    string
		lat     float64
		lng     float64
		houseID int32
	}{
		{"Moscow", 55.751244, 37.618423, 42},
		{"Equator", 0.0, 0.0, 100},
		{"Magnitogorsk", 53.39, 59.07, 999},
		{"HighLatitude", 70.0, 25.0, 7},
		{"Negative", -33.87, 151.21, 5000},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fLat, fLng := FuzzCoordinates(tc.lat, tc.lng, tc.houseID)
			dist := haversineMeters(tc.lat, tc.lng, fLat, fLng)

			if dist > FuzzMaxOffset*1.05 { // 5% tolerance for float math
				t.Errorf("offset %.1f m exceeds max %.1f m", dist, FuzzMaxOffset)
			}
			if dist < FuzzMaxOffset/2*0.95 {
				t.Errorf("offset %.1f m is below minimum %.1f m", dist, FuzzMaxOffset/2)
			}
		})
	}
}

func TestFuzzCoordinates_InsideFuzzRadius(t *testing.T) {
	// The real point must always be inside the circle of FuzzRadius centered
	// at the fuzzed point.
	for id := int32(1); id <= 200; id++ {
		lat, lng := 55.0+float64(id)*0.01, 37.0+float64(id)*0.01
		fLat, fLng := FuzzCoordinates(lat, lng, id)
		dist := haversineMeters(lat, lng, fLat, fLng)
		if dist >= FuzzRadius {
			t.Fatalf("houseID=%d: real point is %.1f m from fuzzed center, outside FuzzRadius=%.0f m",
				id, dist, FuzzRadius)
		}
	}
}
