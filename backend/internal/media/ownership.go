package media

import (
	"fmt"
	"strings"
)

// OwnerPrefix returns the S3 key prefix reserved for one user's public media.
func OwnerPrefix(kind string, ownerID int32) string {
	return fmt.Sprintf("%s/%d/", strings.Trim(kind, "/"), ownerID)
}

// IsOwnedKey reports whether key belongs to the owner's server-issued prefix.
// Full URLs and legacy unscoped keys intentionally do not match.
func IsOwnedKey(key, kind string, ownerID int32) bool {
	return strings.HasPrefix(strings.TrimSpace(key), OwnerPrefix(kind, ownerID))
}

// RemovedOwnedKeys returns old owner-scoped keys no longer present in current.
func RemovedOwnedKeys(old []string, current []string, kind string, ownerID int32) []string {
	kept := make(map[string]struct{}, len(current))
	for _, key := range current {
		kept[strings.TrimSpace(key)] = struct{}{}
	}

	removed := make([]string, 0)
	seen := make(map[string]struct{}, len(old))
	for _, raw := range old {
		key := strings.TrimSpace(raw)
		if !IsOwnedKey(key, kind, ownerID) {
			continue
		}
		if _, ok := kept[key]; ok {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		removed = append(removed, key)
	}
	return removed
}
