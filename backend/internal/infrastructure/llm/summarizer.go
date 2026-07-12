package llm

import (
	"context"
	"fmt"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type Summarizer struct {
	client *Client
}

func NewSummarizer(client *Client) *Summarizer {
	return &Summarizer{client: client}
}

func (s *Summarizer) GenerateReviewsSummary(ctx context.Context, reviews []string) (string, error) {
	if len(reviews) == 0 {
		return "", nil
	}

	var sb strings.Builder
	for i, r := range reviews {
		scrubbed := ScrubPII(r)
		sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, scrubbed))
	}

	systemPrompt := "Ты — профессиональный ИИ-ассистент по анализу отзывов. Твоя задача — составить краткую выжимку (summary) отзывов гостей о квартире. Текст должен быть на русском языке. Выдели основные плюсы и минусы квартиры, которые упоминают гости. Будь краток, напиши 3-4 маркированных пункта (bullet points). Не упоминай имена гостей, даты или личные данные. Если в отзывах есть противоречивая информация, выдели это нейтрально." + UntrustedInputRule
	// Reviews are guest-authored free text — fence them so embedded
	// instructions ("ignore previous instructions...") are treated as data.
	userPrompt := fmt.Sprintf("Список отзывов:\n%s", WrapUntrusted(sb.String()))

	return s.client.Generate(ctx, systemPrompt, userPrompt, 120, 0.5)
}

func (s *Summarizer) GenerateLocationSummary(ctx context.Context, city, street, district string, pois []domain.HousePOI) (string, error) {
	// Limit and sanitize POIs for safety and to prevent prompt injection
	poisParts := make([]string, 0, len(pois))
	limit := 5
	if len(pois) < limit {
		limit = len(pois)
	}
	for i := 0; i < limit; i++ {
		p := pois[i]
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

		// Validate type
		pType := strings.ToLower(strings.TrimSpace(p.Type))
		switch pType {
		case "subway", "park", "shop", "landmark", "cafe", "station":
			// ok
		default:
			pType = "unknown"
		}

		// Validate distance
		dist := p.Distance
		if dist < 0 {
			dist = 0
		}
		if dist > 5000 {
			dist = 5000
		}

		poisParts = append(poisParts, fmt.Sprintf("%s (%s, %dм)", cleanedName, pType, dist))
	}

	poisStr := "не указаны"
	if len(poisParts) > 0 {
		poisStr = strings.Join(poisParts, ", ")
	}

	systemPrompt := "Ты — профессиональный ИИ-ассистент по описанию районов. Твоя задача — составить короткое, привлекательное описание расположения жилья (блурб района) на основе города, улицы и списка ближайших ориентиров (POI). Текст должен быть на русском языке и состоять ровно из 2 предложений. Не выдумывай другие ориентиры."

	locInfo := fmt.Sprintf("Город: %s", city)
	if street != "" {
		locInfo += fmt.Sprintf(", Улица: %s", street)
	}
	if district != "" {
		locInfo += fmt.Sprintf(", Район: %s", district)
	}
	userPrompt := fmt.Sprintf("Локация:\n%s\n[UNTRUSTED_CONTENT_START]\nОриентиры (заявлено владельцем): %s\n[UNTRUSTED_CONTENT_END]", locInfo, poisStr)

	// Reasoning models can spend a substantial part of the completion budget
	// before producing the requested two sentences.
	return s.client.Generate(ctx, systemPrompt, userPrompt, 700, 0.2)
}
