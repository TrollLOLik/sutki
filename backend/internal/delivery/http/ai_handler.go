package http

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/llm"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/listing"
	"github.com/go-chi/chi/v5"
)

type AIHandler struct {
	llmClient   *llm.Client
	listingSvc  *listing.Service
	rateLimiter *SlidingWindowLimiter
	debug       bool
}

func NewAIHandler(llmClient *llm.Client, listingSvc *listing.Service, debug bool) *AIHandler {
	return &AIHandler{
		llmClient:   llmClient,
		listingSvc:  listingSvc,
		rateLimiter: NewSlidingWindowLimiter(60 * time.Minute),
		debug:       debug,
	}
}

type ListingDescriptionRequest struct {
	City             string   `json:"city"`
	Street           string   `json:"street"`
	Rooms            string   `json:"rooms"`
	Area             int32    `json:"area"`
	Price            int32    `json:"price"`
	Amenities        []string `json:"amenities"`
	HouseRules       []string `json:"house_rules"`
	DraftDescription string   `json:"draft_description"`
	Action           string   `json:"action"` // "generate", "improve", "shorter", "longer", "friendly", "neighborhood"
	Stream           bool     `json:"stream"`
	Category         string   `json:"category"`
	MaxGuests        int32    `json:"max_guests"`
	CheckInAfter     string   `json:"check_in_after"`
	CheckOutBefore   string   `json:"check_out_before"`
}

func buildListingContext(req ListingDescriptionRequest) string {
	var sb strings.Builder
	if req.Category != "" {
		sb.WriteString(fmt.Sprintf("- Тип жилья: %s\n", req.Category))
	}
	sb.WriteString(fmt.Sprintf("- Город: %s\n", req.City))
	if req.Street != "" {
		sb.WriteString(fmt.Sprintf("- Улица: %s\n", req.Street))
	}
	if req.Rooms != "" {
		sb.WriteString(fmt.Sprintf("- Комнат: %s\n", req.Rooms))
	}
	if req.Area > 0 {
		sb.WriteString(fmt.Sprintf("- Площадь: %d кв.м.\n", req.Area))
	}
	if req.Price > 0 {
		sb.WriteString(fmt.Sprintf("- Цена: %d руб./сутки\n", req.Price))
	}
	if req.MaxGuests > 0 {
		sb.WriteString(fmt.Sprintf("- Вместимость: до %d гостей\n", req.MaxGuests))
	}
	if len(req.Amenities) > 0 {
		sb.WriteString(fmt.Sprintf("- Удобства в квартире: %s\n", strings.Join(req.Amenities, ", ")))
	}
	if req.CheckInAfter != "" {
		sb.WriteString(fmt.Sprintf("- Время заезда: после %s\n", req.CheckInAfter))
	}
	if req.CheckOutBefore != "" {
		sb.WriteString(fmt.Sprintf("- Время выезда: до %s\n", req.CheckOutBefore))
	}
	if len(req.HouseRules) > 0 {
		sb.WriteString(fmt.Sprintf("- Правила проживания: %s\n", strings.Join(req.HouseRules, ", ")))
	}
	return sb.String()
}

type ListingDescriptionResponse struct {
	Description string `json:"description"`
}

func (h *AIHandler) GenerateDescription(w http.ResponseWriter, r *http.Request) {
	var req ListingDescriptionRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	req.City = strings.TrimSpace(req.City)
	req.Street = strings.TrimSpace(req.Street)

	// Strip emails/phone numbers from free-text before it leaves our
	// infrastructure for the (potentially third-party / cross-border) LLM. The
	// owner-authored draft is the main vector for leaking guest/owner contact
	// details; structured fields (city/street) are addresses, not PII.
	// Then fence it as untrusted input (prompt-injection mitigation): the
	// delimiters are stripped from the payload and the system prompt instructs
	// the model to treat the fenced block as data, never as instructions.
	req.DraftDescription = llm.WrapUntrusted(llm.ScrubPII(req.DraftDescription))

	// Apply rate limiting per user (fallback to IP for safety) - Relaxed to 20 requests per hour for interactive editing
	ip := getClientIP(r)
	userID, _ := userIDFromContext(r.Context())
	limitKey := fmt.Sprintf("ai_desc_ip_%s", ip)
	if userID > 0 {
		limitKey = fmt.Sprintf("ai_desc_user_%d", userID)
	}

	if !h.rateLimiter.Allow(limitKey, 20) {
		writeError(w, http.StatusTooManyRequests, "Превышен лимит генераций. Попробуйте позже.")
		return
	}

	var systemPrompt, userPrompt string
	maxTokens := 800
	temperature := 0.3
	contextBlock := buildListingContext(req)

	switch req.Action {
	case "improve":
		systemPrompt = "Ты — профессиональный копирайтер объявлений о посуточной аренде недвижимости на Avito. Твоя задача — улучшить написанный владельцем текст: сделать его продающим, структурированным и привлекательным для гостей, строго сохранив все исходные факты.\n\nСТРОГИЕ ПРАВИЛА ОФОРМЛЕНИЯ И ВЫВОДА:\n1. Верни РОВНО ОДИН вариант описания. НЕ пиши вступлений или пояснений («вот вариант», «я улучшил» и т.п.). Верни ТОЛЬКО готовый текст.\n2. Используй эмодзи-маркеры (например, ✨, 🏡, 📍, 🕒, ����, ✅) для структурирования.\n3. РАЗДЕЛЯЙ текст на логические блоки с абзацами (пустыми строками):\n   - Заголовок-зазывала с эмодзи (например: ✨ Уютная студия в центре Москвы! ✨).\n   - Описание жилья и ключевых преимуществ.\n   - Раздел удобств с эмодзи-буллетами (например: ✅ Быстрый Wi-Fi, ✅ Кондиционер).\n   - Раздел расположения и инфраструктуры (что рядом, transport).\n   - Раздел правил проживания (время заезда/выезда, ограничения).\n4. Категорически ЗАПРЕЩЕНО использовать markdown-заголовки (#, ##, ###), жирный текст (**), списки на дефисах (-) или звездочках (*). Используй только эмодзи-буллеты.\n5. НЕ выдумывай несуществующие удобства или особенности.\n6. ЗАПРЕЩЕНЫ ссылки, телефоны и любые контактные данные."
		userPrompt = fmt.Sprintf(
			"Текст владельца:\n\"%s\"\n\nХарактеристики квартиры для контекста:\n%s",
			req.DraftDescription, contextBlock,
		)
		maxTokens = 800

	case "shorter":
		systemPrompt = "Ты — профессиональный редактор недвижимости. Сократи предоставленное описание квартиры, сделав его более емким и лаконичным, но сохранив продающую структуру с эмодзи и абзацами.\n\nСТРОГИЕ ПРАВИЛА ВЫВОДА:\n- Сделай текст коротким и емким, сохранив ключевые преимущества.\n- Верни РОВНО ОДИН вариант. Только чистый текст без markdown (#, *).\n- Без вступлений и мета-комментариев."
		userPrompt = fmt.Sprintf("Сделай текущее описание более коротким и лаконичным:\n\"%s\"", req.DraftDescription)
		maxTokens = 400

	case "longer":
		systemPrompt = "Ты — профессиональный копирайтер объявлений о посуточной аренде недвижимости на Avito. Сделай предоставленное описание квартиры более подробным, информативным и продающим на основе характеристик.\n\nСТРОГИЕ ПРАВИЛА ОФОРМЛЕНИЯ И ВЫВОДА:\n1. Верни РОВНО ОДИН вариант описания. НЕ пиши вступлений или пояснений.\n2. Используй эмодзи-маркеры (✨, 🏡, 📍, 🕒, 🚭, ✅) для структурирования.\n3. Разделяй текст на логические блоки с абзацами.\n4. Категорически ЗАПРЕЩЕНО использовать markdown-заголовки (#, ##), жирный текст (**). Используй эмодзи-буллеты.\n5. НЕ выдумывай несуществующие удобства или особенности.\n6. ЗАПРЕЩЕНЫ ссылки, телефоны и любые контактные данные."
		userPrompt = fmt.Sprintf(
			"Сделай текущее описание квартиры более подробным и продающим на основе характеристик:\n%s\n\nТекущий текст:\n\"%s\"",
			contextBlock, req.DraftDescription,
		)
		maxTokens = 1000
		temperature = 0.4

	case "friendly":
		systemPrompt = "Ты — гостеприимный хозяин квартиры. Перепиши предоставленное описание в очень теплом, дружелюбном и радушном тоне, создавая ощущение домашнего уюта и сохраняя продающую структуру с эмодзи.\n\nСТРОГИЕ ПРАВИЛА ВЫВОДА:\n- Сохрани все факты неизменными, не выдумывай новые удобства.\n- Верни РОВНО ОДИН вариант. Только чистый текст, без markdown.\n- Без вступлений и мета-комментариев."
		userPrompt = fmt.Sprintf("Перепиши описание в радушном тоне:\n\"%s\"", req.DraftDescription)
		maxTokens = 800

	case "neighborhood":
		systemPrompt = "Ты — профессиональный ИИ-ассистент по описанию районов. Твоя задача — дополнить описание привлекательным блоком про инфраструктуру района на основе локации.\n\nСТРОГИЕ ПРАВИЛА ВЫВОДА:\n- Добавь 2-3 предложения про инфраструктуру улицы и города (кафе, транспорт, магазины). НЕ выдумывай несуществующие POI.\n- Верни РОВНО ОДИН вариант. Только чистый текст, без markdown."
		userPrompt = fmt.Sprintf(
			"Добавь в описание привлекательный блок про инфраструктуру района на основе локации:\nЛокация: город %s, улица %s.\n\nТекущий текст:\n\"%s\"",
			req.City, req.Street, req.DraftDescription,
		)
		maxTokens = 500

	default: // "generate" or empty
		systemPrompt = "Ты — профессиональный копирайтер объявлений о посуточной аренде недвижимости на Avito. Твоя задача — составить продающее, структурированное и привлекательное описание жилья на основе предоставленных характеристик.\n\nСТРОГИЕ ПРАВИЛА ОФОРМЛЕНИЯ И ВЫВОДА:\n1. Верни РОВНО ОДИН вариант описания. НЕ пиши вступлений или пояснений («вот вариант», «я улучшил» и т.п.). Верни ТОЛЬКО готовый текст.\n2. Используй эмодзи-маркеры (например, ✨, 🏡, 📍, 🕒, 🚭, ✅) для структурирования.\n3. РАЗДЕЛЯЙ текст на логические блоки с абзацами (пустыми строками):\n   - Заголовок-зазывала с эмодзи (например: ✨ Уютная студия в центре Москвы! ✨).\n   - Описание жилья и ключевых преимуществ.\n   - Раздел удобств с эмодзи-буллетами (например: ✅ Быстрый Wi-Fi, ✅ Кондиционер).\n   - Раздел расположения и инфраструктуры (что рядом, транспорт).\n   - Раздел правил проживания (время заезда/выезда, ограничения).\n4. Категорически ЗАПРЕЩЕНО использовать markdown-заголовки (#, ##, ###), жирный текст (**), списки на дефисах (-) или звездочках (*). Используй только эмодзи-буллеты.\n5. НЕ выдумывай несуществующие удобства или особенности (если кондиционера нет в списке, не пиши его).\n6. ЗАПРЕЩЕНЫ ссылки, телефоны и любые контактные данные."
		userPrompt = fmt.Sprintf("Создай продающее описание на основе характеристик:\n%s", contextBlock)
		maxTokens = 800
	}

	// Prompt-injection mitigation: tell the model that fenced user text is
	// data, not instructions (see llm.WrapUntrusted above).
	systemPrompt += llm.UntrustedInputRule

	llm.LogPrompt(h.debug, "GenerateDescription", systemPrompt, userPrompt)

	if req.Stream {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		chunkChan, err := h.llmClient.GenerateStream(r.Context(), systemPrompt, userPrompt, maxTokens, temperature)
		if err != nil {
			http.Error(w, "service unavailable", http.StatusFailedDependency)
			return
		}

		flusher, ok := w.(http.Flusher)
		var buffer strings.Builder

		for chunk := range chunkChan {
			// On-the-fly cleanup of markdown elements
			chunk = strings.ReplaceAll(chunk, "*", "")
			chunk = strings.ReplaceAll(chunk, "#", "")
			chunk = strings.ReplaceAll(chunk, "`", "")

			buffer.WriteString(chunk)
			accumulated := strings.ToLower(buffer.String())
			if strings.Contains(accumulated, "вариант 2") || strings.Contains(accumulated, "вариант №2") || strings.Contains(accumulated, "option 2") {
				break
			}

			fmt.Fprintf(w, "%s", chunk)
			if ok {
				flusher.Flush()
			}
		}
		return
	}

	result, err := h.llmClient.Generate(r.Context(), systemPrompt, userPrompt, maxTokens, temperature)
	if err != nil {
		writeError(w, http.StatusFailedDependency, "сервис генерации временно недоступен")
		return
	}

	sanitized := sanitizeDescriptionOutput(result)
	writeJSON(w, http.StatusOK, ListingDescriptionResponse{Description: sanitized})
}

func (h *AIHandler) GetReviewsSummary(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid listing id")
		return
	}

	house, err := h.listingSvc.Get(r.Context(), int32(id))
	if err != nil {
		writeError(w, http.StatusNotFound, "listing not found")
		return
	}

	if house.ReviewsSummary != nil && *house.ReviewsSummary != "" {
		writeJSON(w, http.StatusOK, map[string]string{"summary": *house.ReviewsSummary})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AIHandler) GetLocationSummary(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid listing id")
		return
	}

	house, err := h.listingSvc.Get(r.Context(), int32(id))
	if err != nil {
		writeError(w, http.StatusNotFound, "listing not found")
		return
	}

	if house.LocationSummary != nil && *house.LocationSummary != "" {
		writeJSON(w, http.StatusOK, map[string]string{"summary": *house.LocationSummary})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func sanitizeDescriptionOutput(input string) string {
	lines := strings.Split(input, "\n")
	var resultLines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		// If the model output starts describing multiple options like "Вариант 1", "Вариант 2", "Option 1"
		// we keep only the first variant and discard everything starting from the second variant.
		lower := strings.ToLower(trimmed)
		if strings.Contains(lower, "вариант 2") || strings.Contains(lower, "вариант №2") || strings.Contains(lower, "option 2") {
			break
		}

		// Strip markdown elements, headers, bullets, brackets, or blocks
		trimmed = strings.TrimLeft(trimmed, "#*->• \t")
		trimmed = strings.ReplaceAll(trimmed, "**", "")
		trimmed = strings.ReplaceAll(trimmed, "*", "")
		trimmed = strings.ReplaceAll(trimmed, "`", "")

		// Skip structural titles/subheaders like "Преимущества:", "Описание:", "Вариант 1:", "Вывод:"
		if strings.HasSuffix(trimmed, ":") {
			if len(trimmed) < 25 {
				continue
			}
		}

		if trimmed != "" {
			resultLines = append(resultLines, trimmed)
		}
	}

	// Join them into a single coherent paragraph space-separated, collapse multiple spaces
	joined := strings.Join(resultLines, " ")
	for strings.Contains(joined, "  ") {
		joined = strings.ReplaceAll(joined, "  ", " ")
	}

	return strings.TrimSpace(joined)
}
