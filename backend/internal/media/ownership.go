package media

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

// OwnerPrefix returns the S3 key prefix reserved for one user's public media.
func OwnerPrefix(kind string, ownerID int32) string {
	return fmt.Sprintf("%s/%d/", strings.Trim(kind, "/"), ownerID)
}

// IsOwnedKey reports whether key belongs to the owner's server-issued prefix.
// Full URLs and legacy unscoped keys intentionally do not match.
//
// A prefix test alone is not enough. Every key this server mints is
// "<kind>/<ownerID>/<name>" with no further structure, so accepting
// "listings/42/../99/photo.jpg" for user 42 would let a key that names another
// user's object pass an ownership check — and one of the callers (the listing
// image moderator) deletes what it rejects. S3 keys are nominally opaque and do
// not resolve dot segments, but the whole point of putting the owner in the key
// is that the check is exact, so the remainder must be a single plain segment.
func IsOwnedKey(key, kind string, ownerID int32) bool {
	trimmed := strings.TrimSpace(key)
	prefix := OwnerPrefix(kind, ownerID)
	if !strings.HasPrefix(trimmed, prefix) {
		return false
	}
	name := trimmed[len(prefix):]
	if name == "" || name == "." || name == ".." {
		return false
	}
	return !strings.ContainsAny(name, "/\\")
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

// extPattern bounds the file extension carried over from a client-supplied file
// name into an object key.
//
// filepath.Ext returns whatever followed the last dot, unbounded and
// unvalidated. Two things go wrong without a clamp. A 200-character
// "extension" becomes part of the key. And an extension containing "${"
// reaches the presigned POST policy, where the AWS SDK may emit a
// `starts-with` condition instead of pinning the key exactly — which would let
// the client choose where the object lands, and the whole owner-in-the-key
// scheme rests on it not being able to.
var extPattern = regexp.MustCompile(`^\.[A-Za-z0-9]{1,10}$`)

// SafeExt returns the extension to carry into an object key, or "" when the
// client's is not one we are willing to put there. A key with no extension is
// perfectly serviceable; the extension is a convenience, not data.
func SafeExt(fileName string) string {
	ext := filepath.Ext(fileName)
	if !extPattern.MatchString(ext) {
		return ""
	}
	return ext
}
