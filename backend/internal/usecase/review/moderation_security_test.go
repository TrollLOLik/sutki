package review

import "testing"

func TestApplyReviewConfidencePolicyFailsClosed(t *testing.T) {
	got := applyReviewConfidencePolicy(reviewVerdict{
		Decision:   "approve",
		Category:   "clean",
		Confidence: 0.79,
	})
	if got.Decision != "review" || got.Category != "low_confidence" {
		t.Fatalf("low-confidence approval = %#v, want review", got)
	}

	got = applyReviewConfidencePolicy(reviewVerdict{
		Decision:   "approve_masked",
		Category:   "profanity",
		Confidence: 0.8,
	})
	if got.Decision != "approve_masked" {
		t.Fatalf("threshold approval changed unexpectedly: %#v", got)
	}
}

func TestParseReviewVerdictRejectsInvalidConfidence(t *testing.T) {
	if _, err := parseReviewVerdict(`{"decision":"approve","category":"clean","reason":"","confidence":1.1}`); err == nil {
		t.Fatal("confidence above one must be rejected")
	}
	if _, err := parseReviewVerdict(`{"decision":"reject","category":"abuse","reason":"x","confidence":-0.1}`); err == nil {
		t.Fatal("negative confidence must be rejected")
	}
}
