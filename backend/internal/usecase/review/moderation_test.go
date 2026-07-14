package review

import (
	"strings"
	"testing"
)

func TestInspectTextMasksOnlyDetectedProfanity(t *testing.T) {
	body := "Квартира хорошая, но хозяин с у к а опоздал"
	got := inspectText(body)
	if got.MaskedBody != "Квартира хорошая, но хозяин *** опоздал" {
		t.Fatalf("masked body = %q", got.MaskedBody)
	}
	if !containsCategory(got.Categories, "profanity") {
		t.Fatalf("categories = %v", got.Categories)
	}
}

func TestInspectTextDoesNotRewriteCleanReview(t *testing.T) {
	body := "Чистая квартира рядом с метро"
	got := inspectText(body)
	if got.MaskedBody != body {
		t.Fatalf("clean review changed: %q", got.MaskedBody)
	}
}

func TestInspectTextDetectsContacts(t *testing.T) {
	got := inspectText("Позвоните мне +7 999 123-45-67")
	if !containsCategory(got.Categories, "contacts") {
		t.Fatalf("categories = %v", got.Categories)
	}
}

func TestContentHashNormalizesCaseAndWhitespace(t *testing.T) {
	left := reviewContentHash("review", "  Очень   хорошо ")
	right := reviewContentHash("review", "очень хорошо")
	if left != right || len(left) != 64 || strings.Trim(left, "0123456789abcdef") != "" {
		t.Fatalf("unexpected hashes %q %q", left, right)
	}
}

func containsCategory(items []string, wanted string) bool {
	for _, item := range items {
		if item == wanted {
			return true
		}
	}
	return false
}
