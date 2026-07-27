package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "1.0.0", 0},
		{"1.2", "1.2.0", 0}, // missing trailing components are zero
		{"1.2.3", "1.2.4", -1},
		{"1.2.4", "1.2.3", 1},
		{"1.10.0", "1.9.0", 1}, // numeric, not lexicographic
		{"2.0.0", "1.99.99", 1},
		{"v1.2.3", "1.2.3", 0},        // leading v tolerated
		{"1.2.3-beta.1", "1.2.3", 0},  // pre-release ignored for ordering
		{"1.2.3+build.7", "1.2.3", 0}, // build metadata ignored
		{"1.0.0", "1.0.0.1", -1},      // four components supported
	}
	for _, tc := range cases {
		a, okA := parseVersion(tc.a)
		b, okB := parseVersion(tc.b)
		if !okA || !okB {
			t.Fatalf("parse failed for %q/%q", tc.a, tc.b)
		}
		if got := compareVersions(a, b); got != tc.want {
			t.Errorf("compare(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
		}
	}
}

func TestParseVersion_Rejects(t *testing.T) {
	for _, raw := range []string{"", "abc", "1.2.x", "1..2", "-1.0", "1.2.3.4.5"} {
		if _, ok := parseVersion(raw); ok {
			t.Errorf("parseVersion(%q) accepted, want rejected", raw)
		}
	}
}

func TestMinAppVersionGate(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot) // a status the gate never produces
	})

	cases := []struct {
		name    string
		minimum string
		header  string
		want    int
	}{
		{"older build is blocked", "1.2.0", "1.1.9", http.StatusUpgradeRequired},
		{"exact minimum passes", "1.2.0", "1.2.0", http.StatusTeapot},
		{"newer build passes", "1.2.0", "1.3.0", http.StatusTeapot},
		// Non-app callers (browser, curl, webhooks) never send the header and
		// must not be locked out — the gate is a UX guard, not a control.
		{"missing header passes", "1.2.0", "", http.StatusTeapot},
		{"unparseable header passes", "1.2.0", "not-a-version", http.StatusTeapot},
		{"empty minimum disables the gate", "", "0.0.1", http.StatusTeapot},
		{"unparseable minimum disables the gate", "latest", "0.0.1", http.StatusTeapot},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
			if tc.header != "" {
				req.Header.Set(appVersionHeader, tc.header)
			}
			rec := httptest.NewRecorder()
			minAppVersionGate(tc.minimum)(next).ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d", rec.Code, tc.want)
			}
		})
	}
}

func TestMinAppVersionGate_BodyIsActionable(t *testing.T) {
	next := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	req.Header.Set(appVersionHeader, "1.0.0")
	rec := httptest.NewRecorder()

	minAppVersionGate("1.2.0")(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusUpgradeRequired {
		t.Fatalf("status = %d, want 426", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body is not JSON: %v", err)
	}
	// The client keys its blocking screen off these two fields; a change here
	// silently turns the update prompt back into a generic error.
	if body["error"] != "app_upgrade_required" {
		t.Errorf("error = %v, want app_upgrade_required", body["error"])
	}
	if body["minimum_supported_version"] != "1.2.0" {
		t.Errorf("minimum_supported_version = %v, want 1.2.0", body["minimum_supported_version"])
	}
}
