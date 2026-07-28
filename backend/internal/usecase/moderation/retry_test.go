package moderation

import (
	"testing"
	"time"
)

func TestRecoveryRetryDelay(t *testing.T) {
	tests := []struct {
		attempts int
		want     time.Duration
	}{
		{attempts: 4, want: 30 * time.Minute},
		{attempts: 5, want: time.Hour},
		{attempts: 6, want: 6 * time.Hour},
		{attempts: 20, want: 6 * time.Hour},
	}

	for _, tt := range tests {
		if got := recoveryRetryDelay(tt.attempts); got != tt.want {
			t.Fatalf("recoveryRetryDelay(%d) = %s, want %s", tt.attempts, got, tt.want)
		}
	}
}
