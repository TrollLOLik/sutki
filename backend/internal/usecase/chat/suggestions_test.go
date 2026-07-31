package chat

import (
	"strings"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestParseSuggestionsExtractsArrayFromProse(t *testing.T) {
	// Models routinely wrap JSON in prose or code fences, which is why the
	// parser locates the array by brackets instead of unmarshalling the reply.
	raw := "Вот варианты:\n```json\n[\"Даты свободны\",\"Уточните число гостей\",\"Заезд после 14:00\"]\n```"

	got := parseSuggestions(raw)
	if len(got) != 3 {
		t.Fatalf("expected 3 suggestions, got %d (%v)", len(got), got)
	}
	if got[0] != "Даты свободны" {
		t.Fatalf("unexpected first suggestion: %q", got[0])
	}
}

func TestParseSuggestionsDropsDuplicates(t *testing.T) {
	// Three rephrasings of one idea waste all three chips.
	raw := `["Даты свободны","даты свободны","Уточните даты"]`

	got := parseSuggestions(raw)
	if len(got) != 2 {
		t.Fatalf("expected duplicates collapsed to 2, got %d (%v)", len(got), got)
	}
}

func TestParseSuggestionsCapsAtCount(t *testing.T) {
	raw := `["Один","Два","Три","Четыре","Пять"]`

	got := parseSuggestions(raw)
	if len(got) != SuggestionsCount {
		t.Fatalf("expected %d suggestions, got %d", SuggestionsCount, len(got))
	}
}

func TestParseSuggestionsRejectsGarbage(t *testing.T) {
	for _, raw := range []string{
		"",
		"Извините, не могу помочь",
		"{\"suggestions\": \"нет\"}",
		"[",
	} {
		if got := parseSuggestions(raw); len(got) != 0 {
			t.Fatalf("expected no suggestions for %q, got %v", raw, got)
		}
	}
}

// A suggestion is pre-filled into the user's own input, so contact details in
// it would help move the deal off-platform — exactly what the anti-scam notice
// on this screen warns against. Such entries are dropped, not scrubbed: a
// half-redacted sentence is not a usable reply.
func TestSanitizeSuggestionDropsContactDetails(t *testing.T) {
	cases := []string{
		"Звоните мне на +7 999 123-45-67",
		"Напишите на почту owner@example.com",
		"Подробности здесь https://example.com/deal",
		"Пишите в WhatsApp",
		"Мой телеграм @owner",
		"Смотрите www.example.com",
	}
	for _, input := range cases {
		if got := sanitizeSuggestion(input); got != "" {
			t.Fatalf("expected %q to be rejected, got %q", input, got)
		}
	}
}

func TestSanitizeSuggestionTrimsMarkdownAndWhitespace(t *testing.T) {
	got := sanitizeSuggestion("  - **Даты   свободны**  ")
	if got != "Даты свободны" {
		t.Fatalf("unexpected sanitised value: %q", got)
	}
}

func TestSanitizeSuggestionRejectsOverlyLong(t *testing.T) {
	long := strings.Repeat("а", suggestionMaxLength+1)
	if got := sanitizeSuggestion(long); got != "" {
		t.Fatalf("expected long suggestion to be rejected, got %q", got)
	}
	// Cyrillic is multi-byte: the limit must count runes, not bytes, otherwise
	// a valid Russian phrase gets rejected at half the intended length.
	exact := strings.Repeat("б", suggestionMaxLength)
	if got := sanitizeSuggestion(exact); got != exact {
		t.Fatalf("expected exactly-at-limit suggestion to pass, got %q", got)
	}
}

func TestSuggestionCacheInvalidatesOnNewMessage(t *testing.T) {
	cache := newSuggestionCache()
	cache.put(1, SuggestionRoleHost, 100, []string{"a", "b", "c"})

	if _, ok := cache.get(1, SuggestionRoleHost, 100); !ok {
		t.Fatal("expected a hit for the same last-message id")
	}
	// A new message means the previous suggestions answer the wrong thing.
	if _, ok := cache.get(1, SuggestionRoleHost, 101); ok {
		t.Fatal("expected a miss after the conversation moved on")
	}
	// Host and guest get different advice, so the role is part of the key.
	if _, ok := cache.get(1, SuggestionRoleGuest, 100); ok {
		t.Fatal("expected a miss for the other role")
	}
}

func TestSuggestionCacheRespectsTTL(t *testing.T) {
	cache := newSuggestionCache()
	cache.entries[suggestionCacheKey(7, SuggestionRoleGuest)] = suggestionCacheEntry{
		suggestions:   []string{"a"},
		lastMessageID: 5,
		expiresAt:     time.Now().Add(-time.Minute),
	}

	if _, ok := cache.get(7, SuggestionRoleGuest, 5); ok {
		t.Fatal("expected expired entry to miss")
	}
}

// The prompt must fence dialog text and strip PII before it leaves our
// infrastructure for the model.
func TestBuildSuggestionPromptFencesAndScrubsDialog(t *testing.T) {
	senderID := int32(42)
	sctx := domain.SuggestionContext{
		City:      "Казань",
		Street:    "Баумана",
		CountRoom: "2",
		Price:     4200,
		Messages: []domain.SuggestionMessage{
			{SenderID: &senderID, Kind: domain.MessageKindUser, Body: "Звоните на +7 999 123-45-67"},
			{SenderID: nil, Kind: domain.MessageKindBookingStatus, Body: "Новая заявка"},
		},
	}

	prompt := buildSuggestionPrompt(senderID, sctx)

	if !strings.Contains(prompt, "<untrusted_input>") {
		t.Fatal("dialog must be fenced as untrusted input")
	}
	if strings.Contains(prompt, "999 123-45-67") {
		t.Fatal("phone number leaked into the prompt")
	}
	if !strings.Contains(prompt, "[PHONE_REDACTED]") {
		t.Fatal("expected the phone number to be redacted")
	}
	// Own messages are labelled distinctly so the model answers the other side.
	if !strings.Contains(prompt, "Я:") {
		t.Fatal("expected own message to be labelled")
	}
	if !strings.Contains(prompt, "Система:") {
		t.Fatal("expected booking card to be labelled as system")
	}
	if !strings.Contains(prompt, "Казань") || !strings.Contains(prompt, "Баумана") || !strings.Contains(prompt, "4200") {
		t.Fatal("expected listing facts in the prompt")
	}
}

func TestBuildSuggestionPromptHandlesEmptyDialog(t *testing.T) {
	prompt := buildSuggestionPrompt(1, domain.SuggestionContext{})
	if !strings.Contains(prompt, "переписка ещё не начата") {
		t.Fatal("expected a placeholder for an empty dialog")
	}
	if !strings.Contains(prompt, "нет данных") {
		t.Fatal("expected a placeholder when no listing facts are known")
	}
}

func TestSuggestionSystemPromptDiffersByRole(t *testing.T) {
	host := suggestionSystemPrompt(SuggestionRoleHost)
	guest := suggestionSystemPrompt(SuggestionRoleGuest)

	if host == guest {
		t.Fatal("host and guest prompts must differ")
	}
	if !strings.Contains(host, "ВЛАДЕЛЬЦА") {
		t.Fatal("host prompt must state the owner role")
	}
	if !strings.Contains(guest, "ГОСТЯ") {
		t.Fatal("guest prompt must state the guest role")
	}
}
