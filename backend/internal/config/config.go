package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"
)

// Config holds all runtime configuration, populated from environment variables.
type Config struct {
	HTTPAddr     string
	DatabaseURL  string
	MediaBaseURL string
	JWTSecret    string
	AccessTTL    time.Duration
	RefreshTTL   time.Duration
	// AuthExposeCode returns login codes in the API response and logs them
	// (dev only). Defaults to false; opt in explicitly via AUTH_EXPOSE_CODE=true.
	AuthExposeCode bool
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration

	// SMTP settings for email-code sending (Yandex)
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string

	DadataAPIKey string
}

// Load reads configuration from the environment. DATABASE_URL is required.
func Load() (Config, error) {
	cfg := Config{
		HTTPAddr:       getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		MediaBaseURL:   getEnv("MEDIA_BASE_URL", ""),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		AccessTTL:      getDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTTL:     getDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		AuthExposeCode: getBool("AUTH_EXPOSE_CODE", false),
		ReadTimeout:    15 * time.Second,
		WriteTimeout:   15 * time.Second,

		SMTPHost:     getEnv("SMTP_HOST", "smtp.yandex.ru"),
		SMTPPort:     getInt("SMTP_PORT", 465),
		SMTPUsername: os.Getenv("SMTP_USERNAME"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:     os.Getenv("SMTP_FROM"),

		DadataAPIKey: os.Getenv("DADATA_API_KEY"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		// Dev fallback: tokens won't survive a restart. Set JWT_SECRET in prod.
		secret, err := randomSecret()
		if err != nil {
			return Config{}, err
		}
		cfg.JWTSecret = secret
		log.Println("config: JWT_SECRET not set, using a random ephemeral secret (tokens invalid across restarts)")
	}
	return cfg, nil
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func getDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}

func randomSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func getInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return i
}

