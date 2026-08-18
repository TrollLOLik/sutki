package config

import (
	"strings"
	"testing"
	"time"
)

func TestConfigureReviewAuth(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		cfg := Config{ReviewAuthEnabled: true, ReviewAuthEmail: "review@wigaj.ru", ReviewAuthCode: "012345"}
		if err := configureReviewAuth(&cfg, "2026-09-15T00:00:00Z"); err != nil {
			t.Fatalf("configure: %v", err)
		}
		want := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
		if !cfg.ReviewAuthExpiresAt.Equal(want) {
			t.Fatalf("expiry = %s, want %s", cfg.ReviewAuthExpiresAt, want)
		}
	})

	t.Run("disabled clears secrets", func(t *testing.T) {
		cfg := Config{ReviewAuthEmail: "review@wigaj.ru", ReviewAuthCode: "123456"}
		if err := configureReviewAuth(&cfg, "2026-09-15T00:00:00Z"); err != nil {
			t.Fatalf("configure: %v", err)
		}
		if cfg.ReviewAuthEmail != "" || cfg.ReviewAuthCode != "" || !cfg.ReviewAuthExpiresAt.IsZero() {
			t.Fatal("disabled reviewer configuration retained credentials")
		}
	})

	for _, tc := range []struct {
		name, email, code, expires string
		want                       string
	}{
		{"display name", "Review <review@wigaj.ru>", "123456", "2026-09-15T00:00:00Z", "REVIEW_AUTH_EMAIL"},
		{"short code", "review@wigaj.ru", "12345", "2026-09-15T00:00:00Z", "REVIEW_AUTH_CODE"},
		{"non digit", "review@wigaj.ru", "12345x", "2026-09-15T00:00:00Z", "REVIEW_AUTH_CODE"},
		{"missing expiry", "review@wigaj.ru", "123456", "", "REVIEW_AUTH_EXPIRES_AT"},
		{"bad expiry", "review@wigaj.ru", "123456", "tomorrow", "REVIEW_AUTH_EXPIRES_AT"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := Config{ReviewAuthEnabled: true, ReviewAuthEmail: tc.email, ReviewAuthCode: tc.code}
			err := configureReviewAuth(&cfg, tc.expires)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error = %v, want one containing %q", err, tc.want)
			}
		})
	}
}
