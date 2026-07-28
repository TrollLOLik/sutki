package http

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

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
	POIs             []poiDTO `json:"pois"`
}

func validateListingDescriptionRequest(req *ListingDescriptionRequest) error {
	fields := []struct {
		name  string
		value *string
		max   int
	}{
		{"city", &req.City, 100},
		{"street", &req.Street, 200},
		{"rooms", &req.Rooms, 40},
		{"category", &req.Category, 80},
		{"check_in_after", &req.CheckInAfter, 20},
		{"check_out_before", &req.CheckOutBefore, 20},
		{"draft_description", &req.DraftDescription, 4000},
	}
	for _, field := range fields {
		*field.value = strings.TrimSpace(*field.value)
		if utf8.RuneCountInString(*field.value) > field.max {
			return fmt.Errorf("%s is too long", field.name)
		}
	}
	if len(req.Amenities) > 40 || len(req.HouseRules) > 20 || len(req.POIs) > 10 {
		return fmt.Errorf("too many structured values")
	}
	for i := range req.Amenities {
		req.Amenities[i] = strings.TrimSpace(req.Amenities[i])
		if utf8.RuneCountInString(req.Amenities[i]) > 80 {
			return fmt.Errorf("amenity is too long")
		}
	}
	for i := range req.HouseRules {
		req.HouseRules[i] = strings.TrimSpace(req.HouseRules[i])
		if utf8.RuneCountInString(req.HouseRules[i]) > 120 {
			return fmt.Errorf("house rule is too long")
		}
	}
	for i := range req.POIs {
		req.POIs[i].Name = strings.TrimSpace(req.POIs[i].Name)
		req.POIs[i].Type = strings.TrimSpace(req.POIs[i].Type)
		if utf8.RuneCountInString(req.POIs[i].Name) > 100 || utf8.RuneCountInString(req.POIs[i].Type) > 50 {
			return fmt.Errorf("point of interest is too long")
		}
	}
	switch req.Action {
	case "", "generate", "improve", "shorter", "longer", "friendly", "neighborhood":
	default:
		return fmt.Errorf("unsupported action")
	}
	return nil
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
	if err := validateListingDescriptionRequest(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Слишком длинные или некорректные данные для генерации описания.")
		return
	}

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
	// Every string in the request is user-controlled, including values that
	// look structured (category, address, amenities and POI names). Fence the
	// whole context and the draft independently so none of those fields can
	// escape into the instruction channel.
	contextBlock := llm.WrapUntrusted(llm.ScrubPII(buildListingContext(req)))
	draftBlock := llm.WrapUntrusted(llm.ScrubPII(req.DraftDescription))

	switch req.Action {
	case "improve":
		systemPrompt = "Ты — редактор объявлений для платформы посуточной аренды жилья. Твоя задача — красиво оформить и улучшить структуру текста, предоставленного владельцем.\n\nКРИТИЧЕСКИ ВАЖНО:\nРазрешено использовать только факты из входных данных. Любая информация, которой нет во входных данных, считается неизвестной и не должна добавляться в текст.\n\nНапример, категорически ЗАПРЕЩЕНО добавлять от себя:\n- близлежащие станции метро и расстояния/время до них (например, «5 минут пешком до метро»);\n- расположенные поблизости конкретные магазины, кафе, ТЦ или парки;\n- характеристики транспортной доступности;\n- видовые характеристики жилья и отзывы об уборке/чистоте;\n- любые преимущества и описания района.\n\nЕсли во входных данных этой информации нет — полностью пропусти эти пункты.\n\nСТРОГИЕ ПРАВИЛА ОФОРМЛЕНИЯ И ВЫВОДА:\n1. Верни РОВНО ОДИН вариант описания. НЕ пиши вступлений или пояснений. Верни ТОЛЬКО готовый текст.\n2. Используй эмодзи-маркеры (например, ✨, 🏡, 📍, 🕒, 🚭, ✅) для структурирования.\n3. РАЗДЕЛЯЙ текст на логические блоки с абзацами (пустыми строками):\n   - Заголовок-зазывала с эмодзи.\n   - Описание жилья и ключевых преимуществ.\n   - Раздел удобств с эмодзи-буллетами (например: ✅ Быстрый Wi-Fi).\n   - Раздел правил проживания (время заезда/выезда, ограничения).\n4. Категорически ЗАПРЕЩЕНО использовать markdown-заголовки (#, ##, ###), жирный текст (**), списки на дефисах (-) или звездочках (*). Используй только эмодзи-буллеты.\n5. ЗАПРЕЩЕНЫ ссылки, телефоны и любые контактные данные."
		userPrompt = fmt.Sprintf(
			"Текст владельца:\n\"%s\"\n\nХарактеристики квартиры для контекста:\n%s",
			draftBlock, contextBlock,
		)
		maxTokens = 800

	case "shorter":
		systemPrompt = "Ты — профессиональный редактор недвижимости. Сократи предоставленное описание квартиры, сделав его более емким и лаконичным, но сохранив продающую структуру с эмодзи и абзацами.\n\nСТРОГИЕ ПРАВИЛА ВЫВОДА:\n- Сделай текст коротким и емким, сохранив ключевые преимущества.\n- Верни РОВНО ОДИН вариант. Только чистый текст без markdown (#, *).\n- Без вступлений и мета-комментариев."
		userPrompt = fmt.Sprintf("Сделай текущее описание более коротким и лаконичным:\n%s", draftBlock)
		maxTokens = 400

	case "longer":
		systemPrompt = "Ты — редактор объявлений для платформы посуточной аренды жилья. Твоя задача — сделать предоставленное описание квартиры более подробным и информативным на основе характеристик.\n\nКРИТИЧЕСКИ ВАЖНО:\nРазрешено использовать только факты из входных данных. Любая информация, которой нет во входных данных, считается неизвестной и не должна добавляться в текст.\n\nНапример, категорически ЗАПРЕЩЕНО добавлять от себя:\n- близлежащие станции метро и расстояния/время до них (например, «5 минут пешком до метро»);\n- расположенные поблизости конкретные магазины, кафе, ТЦ или парки;\n- характеристики транспортной доступности;\n- видовые характеристики жилья и отзывы об уборке/чистоте;\n- любые преимущества и описания района.\n\nЕсли во входных данных этой информации нет — полностью пропусти эти пункты.\n\nСТРОГИЕ ПРАВИЛА ОФОРМЛЕНИЯ И ВЫВОДА:\n1. Верни РОВНО ОДИН вариант описания. НЕ пиши вступлений или пояснений.\n2. Используй эмодзи-маркеры (например, ✨, 🏡, 📍, 🕒, 🚭, ✅) для структурирования.\n3. Разделяй текст на логические блоки с абзацами.\n4. Категорически ЗАПРЕЩЕНО использовать markdown-заголовки (#, ##), жирный текст (**). Используй эмодзи-буллеты.\n5. ЗАПРЕЩЕНЫ ссылки, телефоны и любые контактные данные."
		userPrompt = fmt.Sprintf(
			"Сделай текущее описание квартиры более подробным и продающим на основе характеристик:\n%s\n\nТекущий текст:\n\"%s\"",
			contextBlock, draftBlock,
		)
		maxTokens = 1000
		temperature = 0.4

	case "friendly":
		systemPrompt = "Ты — гостеприимный владелец квартиры. Перепиши предоставленное описание в очень теплом, дружелюбном и радушном тоне, создавая ощущение домашнего уюта и сохраняя продающую структуру с эмодзи.\n\nСТРОГИЕ ПРАВИЛА ВЫВОДА:\n- Сохрани все факты неизменными, не выдумывай новые удобства.\n- Верни РОВНО ОДИН вариант. Только чистый текст, без markdown.\n- Без вступлений и мета-комментариев."
		userPrompt = fmt.Sprintf("Перепиши описание в радушном тоне:\n%s", draftBlock)
		maxTokens = 800

	case "neighborhood":
		poisParts := make([]string, 0, len(req.POIs))
		limit := 5
		if len(req.POIs) < limit {
			limit = len(req.POIs)
		}
		for i := 0; i < limit; i++ {
			p := req.POIs[i]
			cleanedName := strings.ReplaceAll(p.Name, "\n", " ")
			cleanedName = strings.ReplaceAll(cleanedName, "\r", " ")
			cleanedName = strings.ReplaceAll(cleanedName, "[", " ")
			cleanedName = strings.ReplaceAll(cleanedName, "]", " ")
			if len(cleanedName) > 60 {
				cleanedName = cleanedName[:60]
			}
			cleanedName = strings.TrimSpace(cleanedName)
			if cleanedName == "" {
				continue
			}
			poisParts = append(poisParts, fmt.Sprintf("%s (%dм)", cleanedName, p.Distance))
		}
		poisStr := "не указаны"
		if len(poisParts) > 0 {
			poisStr = strings.Join(poisParts, ", ")
		}

		systemPrompt = "Ты — профессиональный ИИ-ассистент по описанию районов. Твоя задача — дополнить описание привлекательным блоком про инфраструктуру района на основе локации и ориентиров.\n\nСТРОГИЕ ПРАВИЛА ВЫВОДА:\n- Добавь 2-3 предложения про инфраструктуру улицы и города (кафе, транспорт, магазины), используя предоставленные ориентиры (POI).\n- ЗАПРЕЩЕНО придумывать другие ориентиры, названия станций метро, парков, ТЦ или брендов магазинов, которых нет в предоставленном списке POI.\n- Верни РОВНО ОДИН вариант. Только чистый текст, без markdown."
		locationBlock := llm.WrapUntrusted(llm.ScrubPII(fmt.Sprintf(
			"Город: %s\nУлица: %s\nОриентиры: %s",
			req.City,
			req.Street,
			poisStr,
		)))
		userPrompt = fmt.Sprintf(
			"Добавь в описание блок про инфраструктуру на основе предоставленных данных:\n%s\n\nТекущий текст:\n%s",
			locationBlock,
			draftBlock,
		)
		maxTokens = 500

	default: // "generate" or empty
		systemPrompt = "Ты — редактор объявлений для платформы посуточной аренды жилья. Твоя задача — составить красивое, структурированное описание жилья на основе предоставленных характеристик.\n\nКРИТИЧЕСКИ ВАЖНО:\nРазрешено использовать только факты из входных данных. Любая информация, которой нет во входных данных, считается неизвестной и не должна добавляться в текст.\n\nНапример, категорически ЗАПРЕЩЕНО добавлять от себя:\n- близлежащие станции метро и расстояния/время до них (например, «5 минут пешком до метро»);\n- расположенные поблизости конкретные магазины, кафе, ТЦ или парки;\n- характеристики транспортной доступности;\n- видовые характеристики жилья и отзывы об уборке/чистоте;\n- любые преимущества и описания района.\n\nЕсли во входных данных этой информации нет — полностью пропусти эти пункты.\n\nСТРОГИЕ ПРАВИЛА ОФОРМЛЕНИЯ И ВЫВОДА:\n1. Верни РОВНО ОДИН вариант описания. НЕ пиши вступлений или пояснений. Верни ТОЛЬКО готовый текст.\n2. Используй эмодзи-маркеры (например, ✨, 🏡, 📍, 🕒, 🚭, ✅) для структурирования.\n3. РАЗДЕЛЯЙ текст на логические блоки с абзацами (пустыми строками):\n   - Заголовок-зазывала с эмодзи.\n   - Описание жилья и ключевых преимуществ.\n   - Раздел удобств с эмодзи-буллетами (например: ✅ Быстрый Wi-Fi).\n   - Раздел правил проживания (время заезда/выезда, ограничения).\n4. Категорически ЗАПРЕЩЕНО использовать markdown-заголовки (#, ##, ###), жирный текст (**), списки на дефисах (-) или звездочках (*). Используй только эмодзи-буллеты.\n5. ЗАПРЕЩЕНЫ ссылки, телефоны и любые контактные данные."
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
