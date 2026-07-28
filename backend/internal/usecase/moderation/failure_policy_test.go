package moderation

import (
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestTerminalFailureOutcome(t *testing.T) {
	t.Run("image moderation stays fail closed", func(t *testing.T) {
		status, reason := terminalFailureOutcome(failureStageImage)
		if status != domain.HouseStatusModerationReview {
			t.Fatalf("status = %q, want %q", status, domain.HouseStatusModerationReview)
		}
		if reason == "" {
			t.Fatal("image moderation fallback must explain why manual review is required")
		}
	})

	t.Run("text moderation follows degraded publication policy", func(t *testing.T) {
		status, reason := terminalFailureOutcome(failureStageText)
		if status != domain.HouseStatusActive {
			t.Fatalf("status = %q, want %q", status, domain.HouseStatusActive)
		}
		if reason != "" {
			t.Fatalf("reason = %q, want empty", reason)
		}
	})
}

func TestVerdictOutcome(t *testing.T) {
	tests := []struct {
		name       string
		verdict    moderationLLMVerdict
		wantStatus string
		wantReason string
	}{
		{name: "approve", verdict: moderationLLMVerdict{Decision: domain.ModerationApprove}, wantStatus: domain.HouseStatusActive},
		{name: "confident reject", verdict: moderationLLMVerdict{Decision: domain.ModerationReject, Confidence: 0.95, Reason: "нарушение"}, wantStatus: domain.HouseStatusRejected, wantReason: "нарушение"},
		{name: "uncertain reject", verdict: moderationLLMVerdict{Decision: domain.ModerationReject, Confidence: 0.5, Reason: "сомнение"}, wantStatus: domain.HouseStatusModerationReview},
		{name: "review", verdict: moderationLLMVerdict{Decision: domain.ModerationReview}, wantStatus: domain.HouseStatusModerationReview},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, reason := verdictOutcome(tt.verdict)
			if status != tt.wantStatus || reason != tt.wantReason {
				t.Fatalf("outcome = (%q, %q), want (%q, %q)", status, reason, tt.wantStatus, tt.wantReason)
			}
		})
	}
}

func TestEnqueueFailureNeverLeavesListingPending(t *testing.T) {
	status, reason := enqueueFailureOutcome(true)
	if status != domain.HouseStatusModerationReview || reason == "" {
		t.Fatalf("image listing fallback = (%q, %q), want moderation_review with reason", status, reason)
	}

	status, reason = enqueueFailureOutcome(false)
	if status != domain.HouseStatusActive || reason != "" {
		t.Fatalf("text-only listing fallback = (%q, %q), want active without reason", status, reason)
	}
}
