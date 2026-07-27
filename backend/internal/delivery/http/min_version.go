package http

import (
	"net/http"
	"strconv"
	"strings"
)

// The client sends its version here; extractDeviceInfo already reads the same
// header for session metadata.
const appVersionHeader = "X-App-Version"

// minAppVersionGate refuses requests from client builds older than the
// configured minimum, with 426 Upgrade Required.
//
// Why a distinct status: an old build that hits a tightened endpoint would
// otherwise get a 403 or a 400 and surface it as a form-level error ("что-то
// пошло не так"), leaving the user stuck with no idea an update exists. 426 is
// unambiguous, so the client can render a blocking update screen instead of
// guessing.
//
// A request with no version header is allowed through. The header is only
// absent for non-app callers — a browser, curl, a webhook — and those are not
// what this gate is for. It is a UX guard that turns "mystery error" into
// "update the app", NOT a security control: nothing may depend on it, since a
// client can always send whatever version string it likes. The actual security
// lives in the endpoints themselves.
func minAppVersionGate(minimum string) func(http.Handler) http.Handler {
	min, ok := parseVersion(minimum)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !ok {
				next.ServeHTTP(w, r)
				return
			}
			raw := strings.TrimSpace(r.Header.Get(appVersionHeader))
			if raw == "" {
				next.ServeHTTP(w, r)
				return
			}
			got, parsed := parseVersion(raw)
			if !parsed {
				// An unparseable version is not evidence of an old build, and
				// locking someone out over a malformed header would be worse
				// than letting them through.
				next.ServeHTTP(w, r)
				return
			}
			if compareVersions(got, min) >= 0 {
				next.ServeHTTP(w, r)
				return
			}
			writeJSON(w, http.StatusUpgradeRequired, map[string]any{
				"error":                     "app_upgrade_required",
				"message":                   "Необходимо обновить приложение",
				"minimum_supported_version": minimum,
			})
		})
	}
}

// version is a dot-separated numeric version, compared component-wise.
type version []int

// parseVersion accepts "1", "1.2", "1.2.3" and tolerates a leading "v" and a
// trailing pre-release/build suffix ("1.2.3-beta.1", "1.2.3+42"), which are
// ignored for ordering. Anything else is rejected.
func parseVersion(s string) (version, bool) {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "v")
	if i := strings.IndexAny(s, "-+"); i >= 0 {
		s = s[:i]
	}
	if s == "" {
		return nil, false
	}
	parts := strings.Split(s, ".")
	if len(parts) > 4 {
		return nil, false
	}
	out := make(version, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return nil, false
		}
		out = append(out, n)
	}
	return out, true
}

// compareVersions returns -1, 0 or 1. Missing trailing components count as
// zero, so 1.2 and 1.2.0 compare equal.
func compareVersions(a, b version) int {
	n := len(a)
	if len(b) > n {
		n = len(b)
	}
	for i := 0; i < n; i++ {
		var x, y int
		if i < len(a) {
			x = a[i]
		}
		if i < len(b) {
			y = b[i]
		}
		switch {
		case x < y:
			return -1
		case x > y:
			return 1
		}
	}
	return 0
}
