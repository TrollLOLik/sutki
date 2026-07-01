package domain

import (
	"crypto/sha256"
	"encoding/binary"
	"math"
)

// FuzzRadius is the radius (in meters) of the circle shown on the map for
// fuzzed coordinates.  The actual offset is always ≤ FuzzMaxOffset, so the
// real location is guaranteed to be well inside the displayed circle.
const FuzzRadius float64 = 300.0

// FuzzMaxOffset is the maximum displacement (in meters) applied to the real
// coordinates.  It is intentionally much smaller than FuzzRadius so that the
// true point always lies inside the circle with a ≥200 m safety margin.
const FuzzMaxOffset float64 = 100.0

// FuzzCoordinates returns deterministically shifted lat/lng for a given
// house ID.  The shift direction and distance are derived from a SHA-256 hash
// of the ID, so the output is stable across requests but unpredictable
// without knowing the real coordinates.
//
// Returns (fuzzedLat, fuzzedLng).  The caller should pair these with
// FuzzRadius when building a DTO.
func FuzzCoordinates(lat, lng float64, houseID int32) (float64, float64) {
	// Deterministic seed from house ID.
	var buf [4]byte
	binary.LittleEndian.PutUint32(buf[:], uint32(houseID))
	hash := sha256.Sum256(buf[:])

	// Extract two uint32 values from the hash for angle and distance.
	angleBits := binary.LittleEndian.Uint32(hash[0:4])
	distBits := binary.LittleEndian.Uint32(hash[4:8])

	// Angle ∈ [0, 2π).
	angle := (float64(angleBits) / float64(math.MaxUint32)) * 2 * math.Pi

	// Distance ∈ [FuzzMaxOffset/2, FuzzMaxOffset] — never zero, never > max.
	dist := (FuzzMaxOffset / 2) + (float64(distBits)/float64(math.MaxUint32))*(FuzzMaxOffset/2)

	// Convert metres → degree offsets.
	// 1° latitude  ≈ 111 320 m
	// 1° longitude ≈ 111 320 m × cos(lat)
	const metersPerDeg = 111_320.0
	dLat := (dist * math.Sin(angle)) / metersPerDeg
	dLng := (dist * math.Cos(angle)) / (metersPerDeg * math.Cos(lat*math.Pi/180))

	return lat + dLat, lng + dLng
}
