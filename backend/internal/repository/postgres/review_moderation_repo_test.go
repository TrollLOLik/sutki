package postgres

import "testing"

func TestReviewRejectionReason(t *testing.T) {
	tests := []struct {
		name   string
		status string
		reason string
		want   string
	}{
		{name: "rejected review exposes reason", status: "rejected", reason: "policy violation", want: "policy violation"},
		{name: "approved review hides model explanation", status: "active", reason: "clean review", want: ""},
		{name: "manual review hides internal explanation", status: "moderation_review", reason: "ambiguous", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := reviewRejectionReason(tt.status, tt.reason); got != tt.want {
				t.Fatalf("reviewRejectionReason(%q, %q) = %q, want %q", tt.status, tt.reason, got, tt.want)
			}
		})
	}
}
