package config

import (
	"fmt"
	"os"
	"time"
)

// Config holds all runtime configuration, populated from environment variables.
type Config struct {
	HTTPAddr     string
	DatabaseURL  string
	MediaBaseURL string
	JWTSecret    string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// Load reads configuration from the environment. DATABASE_URL is required.
func Load() (Config, error) {
	cfg := Config{
		HTTPAddr:     getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		MediaBaseURL: getEnv("MEDIA_BASE_URL", ""),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	return cfg, nil
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
