package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/llm"
)

// SuggestionsCount is how many reply chips the client renders.
const SuggestionsCount = 3

// suggestionContextMessages is how much of the dialog tail goes into the prompt.
// Enough to catch the current question, short enough to keep the prompt cheap —
// the whole history would also make the model answer the wrong message.
const suggestionContextMessages = 10

// suggestionCacheTTL bounds how long a cached set survives. The primary
// invalidation is the last-message id, not time; this only keeps entries from
// living forever in a quiet conversation.
const suggestionCacheTTL = 30 * time.Minute

// suggestionMaxLength caps one suggestion. These become chips above the input,
// and anything longer wraps into an unreadable block.
const suggestionMaxLength = 90

// SuggestionRateLimit is how many suggestion requests one user may make per
// hour. Suggestions are fetched on every chat open, so without this an idle
// user flipping between dialogs would bill a paid model repeatedly. Enforced by
// the HTTP layer, which owns the limiter.
const SuggestionRateLimit = 20

// SuggestionRole distinguishes the two sides of a booking dialog. The advice a
// host needs ("confirm the dates") is nothing like what a guest needs ("ask
// about check-in"), so the prompt has to know who is asking.
type SuggestionRole string

const (
	SuggestionRoleHost  SuggestionRole = "host"
	SuggestionRoleGuest SuggestionRole = "guest"
)

// suggestionCacheEntry is one memoised set of suggestions.
type suggestionCacheEntry struct {
	suggestions []string
	// lastMessageID the entry was generated for. A new message invalidates it.
	lastMessageID int64
	expiresAt     time.Time
}

// suggestionCache memoises generated sets in process memory.
//
// Deliberately not Redis: an entry is worthless the moment a new message
// arrives, so it lives seconds to minutes, and a per-instance map costs nothing.
// If the backend is ever scaled out, a cache miss on another instance is just
// one extra generation, not a correctness problem.
type suggestionCache struct {
	mu      sync.Mutex
	entries map[string]suggestionCacheEntry
}

func newSuggestionCache() *suggestionCache {
	return &suggestionCache{entries: make(map[string]suggestionCacheEntry)}
}

func suggestionCacheKey(convID int64, role SuggestionRole) string {
	return fmt.Sprintf("%d:%s", convID, role)
}

func (c *suggestionCache) get(convID int64, role SuggestionRole, lastMessageID int64) ([]string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[suggestionCacheKey(convID, role)]
	if !ok {
		return nil, false
	}
	// The conversation moved on, or the entry aged out.
	if entry.lastMessageID != lastMessageID || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.suggestions, true
}

func (c *suggestionCache) put(convID int64, role SuggestionRole, lastMessageID int64, suggestions []string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Opportunistic eviction: suggestions are a minor feature and must not grow
	// unbounded on a busy instance.
	if len(c.entries) > 5000 {
		now := time.Now()
		for key, entry := range c.entries {
			if now.After(entry.expiresAt) {
				delete(c.entries, key)
			}
		}
	}

	c.entries[suggestionCacheKey(convID, role)] = suggestionCacheEntry{
		suggestions:   suggestions,
		lastMessageID: lastMessageID,
		expiresAt:     time.Now().Add(suggestionCacheTTL),
	}
}

// SuggestionGenerator produces text from a prompt. Implemented by llm.Client;
// an interface so the service can be tested without a provider.
type SuggestionGenerator interface {
	Generate(ctx context.Context, systemPrompt, userPrompt string, maxTokens int, temperature float64) (string, error)
}

// SuggestionsResult carries the chips plus whether they came from the model.
// The flag lets the client tell "AI-generated" from "canned" without guessing.
type SuggestionsResult struct {
	Suggestions []string `json:"suggestions"`
	Generated   bool     `json:"generated"`
}

// SetSuggestionGenerator wires the LLM client used for reply suggestions.
// Optional: with no generator the service serves fallbacks only.
func (s *Service) SetSuggestionGenerator(gen SuggestionGenerator, debug bool) {
	s.suggestionGen = gen
	s.suggestionDebug = debug
}

// Suggestions returns up to SuggestionsCount reply suggestions for a
// conversation.
//
// Only generated for listing-scoped dialogs: in a general conversation there is
// no booking context, and the model would invent one. General dialogs get the
// canned set instead.
//
// Never returns an error for model problems — an unavailable provider must not
// break opening a chat, so any failure degrades to the fallback chips.
func (s *Service) Suggestions(ctx context.Context, userID int32, convID int64) (SuggestionsResult, error) {
	isParticipant, err := s.repo.CheckParticipantExists(ctx, convID, userID)
	if err != nil {
		return SuggestionsResult{}, err
	}
	if !isParticipant {
		return SuggestionsResult{}, domain.ErrBookingForbidden
	}

	sctx, err := s.repo.GetSuggestionContext(ctx, convID, suggestionContextMessages)
	if err != nil {
		return SuggestionsResult{}, err
	}

	role := SuggestionRoleGuest
	if sctx.HouseID != nil && sctx.OwnerID == userID {
		role = SuggestionRoleHost
	}

	// General conversation, or no model configured: the optional feature stays
	// hidden. Static phrases look contextual in the UI but answer the wrong
	// message and become especially confusing during a provider outage.
	if sctx.HouseID == nil || s.suggestionGen == nil {
		return SuggestionsResult{Suggestions: nil, Generated: false}, nil
	}

	if cached, ok := s.suggestionCache.get(convID, role, sctx.LastMessageID); ok {
		return SuggestionsResult{Suggestions: cached, Generated: true}, nil
	}

	suggestions, err := s.generateSuggestions(ctx, role, userID, sctx)
	if err != nil {
		log.Printf("[Chat] Reply suggestions unavailable (conv=%d, role=%s): %v", convID, role, err)
		return SuggestionsResult{Suggestions: nil, Generated: false}, nil
	}

	s.suggestionCache.put(convID, role, sctx.LastMessageID, suggestions)
	return SuggestionsResult{Suggestions: suggestions, Generated: true}, nil
}

// generateSuggestions builds the prompt, calls the model and validates output.
func (s *Service) generateSuggestions(ctx context.Context, role SuggestionRole, userID int32, sctx domain.SuggestionContext) ([]string, error) {
	systemPrompt := suggestionSystemPrompt(role) + llm.UntrustedInputRule
	userPrompt := buildSuggestionPrompt(userID, sctx)

	llm.LogPrompt(s.suggestionDebug, "ChatSuggestions", systemPrompt, userPrompt)

	// Low temperature: these are practical replies about dates and check-in, not
	// creative writing. maxTokens is small — three short lines of JSON.
	raw, err := s.suggestionGen.Generate(ctx, systemPrompt, userPrompt, 220, 0.4)
	if err != nil {
		return nil, err
	}

	suggestions := parseSuggestions(raw)
	if len(suggestions) == 0 {
		return nil, fmt.Errorf("model returned no usable suggestions")
	}
	return suggestions, nil
}

func suggestionSystemPrompt(role SuggestionRole) string {
	common := `Ты помогаешь участнику переписки на российском сервисе посуточной аренды жилья «ВИГАЖ» быстро ответить собеседнику.

Верни РОВНО JSON-массив из 3 строк, без пояснений и markdown. Пример формата:
["Первый вариант","Второй вариант","Третий вариант"]

ПРАВИЛА:
- Каждый вариант — одна короткая реплика от первого лица, не длиннее 90 символов.
- Пиши по-русски, вежливо, на «вы», без эмодзи и без приветствий в каждом варианте.
- Варианты должны быть РАЗНЫМИ по смыслу, а не перефразировкой друг друга.
- Опирайся только на факты из данных о жилье и переписки. Ничего не выдумывай: ни адрес, ни метро, ни удобства, ни скидки.
- ЗАПРЕЩЕНО обещать что-либо от лица сервиса, называть цены, которых нет в данных, предлагать оплату или связь вне приложения, запрашивать или сообщать телефоны, почту и ссылки.
- Если из переписки непонятно, что ответить, предложи уточняющие вопросы.`

	switch role {
	case SuggestionRoleHost:
		return common + `

Ты пишешь от лица ВЛАДЕЛЬЦА жилья, отвечающего гостю. Уместны: подтверждение доступности дат, уточнение числа гостей и времени заезда, напоминание правил проживания.`
	default:
		return common + `

Ты пишешь от лица ГОСТЯ, который интересуется жильём. Уместны: вопрос о свободных датах, времени заезда и выезда, что входит в стоимость, условия заселения.`
	}
}

// buildSuggestionPrompt assembles the listing facts and dialog tail.
//
// Message bodies are guest/host free text: they are PII-scrubbed and fenced as
// untrusted input, so an embedded "ignore previous instructions" is data rather
// than a command. Listing fields are structured server-side values and are not
// fenced.
func buildSuggestionPrompt(userID int32, sctx domain.SuggestionContext) string {
	var facts strings.Builder
	if sctx.City != "" {
		facts.WriteString(fmt.Sprintf("- Город: %s\n", sctx.City))
	}
	if sctx.Street != "" {
		facts.WriteString(fmt.Sprintf("- Улица: %s\n", sctx.Street))
	}
	if sctx.CountRoom != "" {
		facts.WriteString(fmt.Sprintf("- Комнат: %s\n", sctx.CountRoom))
	}
	if sctx.Price > 0 {
		facts.WriteString(fmt.Sprintf("- Цена: %d руб./сутки\n", sctx.Price))
	}
	if sctx.MaxGuests > 0 {
		facts.WriteString(fmt.Sprintf("- Вместимость: до %d гостей\n", sctx.MaxGuests))
	}
	if sctx.CheckInAfter != "" {
		facts.WriteString(fmt.Sprintf("- Заезд после: %s\n", sctx.CheckInAfter))
	}
	if sctx.CheckOutBefore != "" {
		facts.WriteString(fmt.Sprintf("- Выезд до: %s\n", sctx.CheckOutBefore))
	}
	if facts.Len() == 0 {
		facts.WriteString("- нет данных\n")
	}

	var dialog strings.Builder
	for _, msg := range sctx.Messages {
		body := strings.TrimSpace(msg.Body)
		if body == "" {
			continue
		}
		// Booking cards are server-generated status lines, useful as context but
		// not authored by either party.
		speaker := "Собеседник"
		switch {
		case msg.Kind != domain.MessageKindUser:
			speaker = "Система"
		case msg.SenderID != nil && *msg.SenderID == userID:
			speaker = "Я"
		}
		if len(body) > 300 {
			body = body[:300]
		}
		dialog.WriteString(fmt.Sprintf("%s: %s\n", speaker, llm.ScrubPII(body)))
	}
	if dialog.Len() == 0 {
		dialog.WriteString("(переписка ещё не начата)\n")
	}

	return fmt.Sprintf(
		"Данные о жилье:\n%s\nПоследние сообщения переписки:\n%s\n\nПредложи 3 варианта моего следующего сообщения.",
		facts.String(),
		llm.WrapUntrusted(dialog.String()),
	)
}

// parseSuggestions extracts the JSON array from the model output and sanitises
// each entry.
//
// Models wrap JSON in prose or fences often enough that locating the array by
// brackets is more reliable than unmarshalling the whole reply.
func parseSuggestions(raw string) []string {
	start := strings.Index(raw, "[")
	end := strings.LastIndex(raw, "]")
	if start < 0 || end <= start {
		return nil
	}

	var parsed []string
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return nil
	}

	out := make([]string, 0, SuggestionsCount)
	seen := make(map[string]struct{}, SuggestionsCount)
	for _, item := range parsed {
		cleaned := sanitizeSuggestion(item)
		if cleaned == "" {
			continue
		}
		// Models like to return three rephrasings of one idea; identical chips
		// waste a slot.
		key := strings.ToLower(cleaned)
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, cleaned)
		if len(out) == SuggestionsCount {
			break
		}
	}
	return out
}

// sanitizeSuggestion trims markdown leftovers, collapses whitespace and drops
// anything that still leaks contact details.
func sanitizeSuggestion(input string) string {
	cleaned := strings.TrimSpace(input)
	cleaned = strings.ReplaceAll(cleaned, "\n", " ")
	cleaned = strings.ReplaceAll(cleaned, "\r", " ")
	cleaned = strings.Trim(cleaned, "-*•>#\"' \t")
	for strings.Contains(cleaned, "  ") {
		cleaned = strings.ReplaceAll(cleaned, "  ", " ")
	}
	if cleaned == "" {
		return ""
	}

	// A suggestion is inserted into the input for the user to send as their own
	// message. If the model produced a phone number, an email or a link despite
	// the prompt, drop the whole entry: pre-filling contact details would help
	// route the deal outside the platform, which is exactly what the anti-scam
	// notice in this screen warns about.
	if llm.ScrubPII(cleaned) != cleaned {
		return ""
	}
	lower := strings.ToLower(cleaned)
	for _, marker := range []string{"http://", "https://", "www.", "t.me", "@", "whatsapp", "телеграм", "telegram", "вайбер", "viber"} {
		if strings.Contains(lower, marker) {
			return ""
		}
	}

	if len([]rune(cleaned)) > suggestionMaxLength {
		return ""
	}
	return cleaned
}
