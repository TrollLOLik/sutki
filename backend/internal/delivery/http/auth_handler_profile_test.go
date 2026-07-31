package http

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestPublicUserDTOIncludesCreatedAtWithoutEmail(t *testing.T) {
	createdAt := time.Date(2026, time.July, 8, 12, 30, 0, 0, time.UTC)
	payload, err := json.Marshal(toPublicUserDTO(domain.User{
		ID:              42,
		Email:           "private@example.com",
		Phone:           "+79990000000",
		PhoneVerifiedAt: &createdAt,
		Name:            "Александр",
		CreatedAt:       createdAt,
	}))
	if err != nil {
		t.Fatal(err)
	}

	body := string(payload)
	if !strings.Contains(body, `"created_at":"2026-07-08T12:30:00Z"`) {
		t.Fatalf("created_at missing from public profile: %s", body)
	}
	if strings.Contains(body, "private@example.com") || strings.Contains(body, `"email"`) {
		t.Fatalf("email leaked through public profile: %s", body)
	}
	if strings.Contains(body, "+79990000000") {
		t.Fatalf("non-host phone leaked through public profile: %s", body)
	}
}

func TestBirthdayMeetsMinimumAgeAtBoundary(t *testing.T) {
	now := time.Date(2026, time.August, 1, 15, 30, 0, 0, time.UTC)

	tests := []struct {
		name     string
		birthday time.Time
		allowed  bool
	}{
		{
			name:     "birthday before cutoff",
			birthday: time.Date(2008, time.July, 31, 0, 0, 0, 0, time.UTC),
			allowed:  true,
		},
		{
			name:     "birthday on cutoff",
			birthday: time.Date(2008, time.August, 1, 0, 0, 0, 0, time.UTC),
			allowed:  true,
		},
		{
			name:     "birthday after cutoff",
			birthday: time.Date(2008, time.August, 2, 0, 0, 0, 0, time.UTC),
			allowed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := birthdayMeetsMinimumAge(tt.birthday, now); got != tt.allowed {
				t.Fatalf("birthdayMeetsMinimumAge() = %v, want %v", got, tt.allowed)
			}
		})
	}
}
