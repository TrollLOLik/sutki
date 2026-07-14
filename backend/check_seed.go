package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/llm"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	dbURL := "postgres://postgres:MadLust20@localhost:5432/ce76279_sutki?sslmode=disable"
	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("Error opening db: %v", err)
	}
	defer db.Close()

	// 1. Get 2 active house IDs
	rows, err := db.Query("SELECT id, street, country FROM house ORDER BY id DESC LIMIT 2")
	if err != nil {
		log.Fatalf("Error querying houses: %v", err)
	}
	defer rows.Close()

	type HouseInfo struct {
		ID      int32
		Address string
		City    string
	}
	var houses []HouseInfo
	for rows.Next() {
		var h HouseInfo
		if err := rows.Scan(&h.ID, &h.Address, &h.City); err != nil {
			log.Fatalf("Error scanning house: %v", err)
		}
		houses = append(houses, h)
	}

	if len(houses) == 0 {
		fmt.Println("No houses found in database! Please create a listing first.")
		return
	}

	// Get a test user ID to author the reviews
	var authorID int32
	err = db.QueryRow("SELECT id FROM \"user\" LIMIT 1").Scan(&authorID)
	if err != nil {
		// If no users exist, create a dummy test user
		err = db.QueryRow("INSERT INTO \"user\" (email, password_hash, name, surname, phone, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
			"guest_test@sutki.ru", "dummy_hash", "Иван", "Петров", "+79998887766", "guest").Scan(&authorID)
		if err != nil {
			log.Fatalf("Error getting or creating author user: %v", err)
		}
	}

	// 2. Define 3 realistic guest reviews per house
	reviewsData := []struct {
		Rating int32
		Body   string
	}{
		{5, "Отличная квартира! Очень чистая, просторная и светлая. Есть всё необходимое для проживания: посудомойка, кондиционер, быстрый Wi-Fi. Расположение супер, прямо в центре, рядом много кафе и ресторанов. Хозяин очень приветливый, встретил вовремя и всё показал. Обязательно вернемся ещё!"},
		{4, "Квартира хорошая, полностью соответствует фотографиям. Местоположение отличное, до всех достопримечательностей рукой подать. Из небольших минусов — было немного шумно с улицы ночью, но закрытые окна решают проблему. Заселение прошло быстро и без проблем."},
		{5, "Прекрасное жилье, чистота идеальная! Белье свежее, посуда чистая. Очень удобный матрас на кровати, выспались отлично. Район тихий и безопасный. Спасибо за гостеприимство, рекомендую!"},
	}

	// Initialize LLM Client
	llmBaseURL := "https://api.alltokens.ru/api/v1"
	llmAPIKey := "sk-at-pqnKI76AYLqnRvcvCd5zJIVx8LTbYyc16sjPxviXfwk"
	llmModel := "google/gemma-4-31b-it:free"
	
	llmClient := llm.NewClient(llmBaseURL, llmAPIKey, llmModel, 30*time.Second)

	for _, house := range houses {
		fmt.Printf("Processing house ID %d (%s, %s)...\n", house.ID, house.City, house.Address)

		// Insert reviews
		var reviewTexts []string
		for _, rd := range reviewsData {
			var reviewID int32
			err := db.QueryRow("INSERT INTO review (owner_id, house_id, body, rating, status, created_at) VALUES ($1, $2, $3, $4, $5, now()) RETURNING id",
				authorID, house.ID, rd.Body, rd.Rating, "active").Scan(&reviewID)
			if err != nil {
				log.Fatalf("Error inserting review: %v", err)
			}
			reviewTexts = append(reviewTexts, rd.Body)
			fmt.Printf("  Inserted review ID %d (Rating: %d)\n", reviewID, rd.Rating)
		}

		// Generate reviews summary via LLM
		systemPrompt := "Ты — профессиональный ИИ-ассистент по анализу отзывов. Твоя задача — составить краткую выжимку (summary) отзывов гостей о квартире. Текст должен быть на русском языке. Выдели основные плюсы и минусы квартиры, которые упоминают гости. Будь краток, напиши 3-4 маркированных пункта (bullet points). Не упоминай имена гостей, даты или личные данные. Если в отзывах есть противоречивая информация, выдели это нейтрально."
		
		var sb strings.Builder
		for i, r := range reviewTexts {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, r))
		}
		userPrompt := fmt.Sprintf("Список отзывов:\n%s", sb.String())

		fmt.Println("  Calling LLM to generate reviews summary...")
		summary, err := llmClient.Generate(context.Background(), systemPrompt, userPrompt, 150, 0.5)
		if err != nil {
			fmt.Printf("  LLM Error: %v. Falling back to mock summary.\n", err)
			if house.ID == 46 {
				summary = "⭐ Отличная квартира с продуманным зонированием и идеальной чистотой в самом центре.\n✅ Плюсы: быстрый Wi-Fi, кондиционер, посудомоечная машина, приветливый хозяин.\n⚠️ Минусы: из-за центрального расположения ночью на улице может быть шумно."
			} else {
				summary = "⭐ Гости отмечают безупречную чистоту, свежее белье и удобное расположение.\n✅ Плюсы: тихий безопасный район, комфортный матрас, бесконтактное заселение.\n⚠️ Минусы: мелкие замечания к напору горячей воды."
			}
		}

		// Update reviews summary in house table
		_, err = db.Exec("UPDATE house SET reviews_summary = $1 WHERE id = $2", summary, house.ID)
		if err != nil {
			log.Fatalf("Error updating reviews_summary: %v", err)
		}
		fmt.Printf("  Successfully updated reviews_summary for house ID %d:\n  %s\n", house.ID, summary)
	}

	fmt.Println("Done seeding reviews!")
}
