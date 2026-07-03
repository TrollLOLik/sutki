package llm

import (
	"context"
	"fmt"
	"strings"
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

	systemPrompt := "Ты — профессиональный ИИ-ассистент по анализу отзывов. Твоя задача — составить краткую выжимку (summary) отзывов гостей о квартире. Текст должен быть на русском языке. Выдели основные плюсы и минусы квартиры, которые упоминают гости. Будь краток, напиши 3-4 маркированных пункта (bullet points). Не упоминай имена гостей, даты или личные данные. Если в отзывах есть противоречивая информация, выдели это нейтрально."
	userPrompt := fmt.Sprintf("Список отзывов:\n%s", sb.String())

	return s.client.Generate(ctx, systemPrompt, userPrompt, 120, 0.5)
}

func (s *Summarizer) GenerateLocationSummary(ctx context.Context, city, street, district string) (string, error) {
	systemPrompt := "Ты — профессиональный ИИ-ассистент по описанию районов. Твоя задача — составить короткое, привлекательное описание расположения жилья (блурб района) на основе города и улицы/района. Текст должен быть на русском языке и состоять из 2 предложений. Сделай упор на транспортную доступность и инфраструктуру."
	
	locInfo := fmt.Sprintf("Город: %s", city)
	if street != "" {
		locInfo += fmt.Sprintf(", Улица: %s", street)
	}
	if district != "" {
		locInfo += fmt.Sprintf(", Район: %s", district)
	}
	userPrompt := fmt.Sprintf("Локация:\n%s", locInfo)

	return s.client.Generate(ctx, systemPrompt, userPrompt, 80, 0.5)
}
