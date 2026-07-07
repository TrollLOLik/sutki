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

// weakSecrets are well-known placeholder values that must never be used for
// signing secrets in any environment.
var weakSecrets = map[string]struct{}{
	"YOUR_SHARED_HMAC_SECRET_KEY": {},
	"dev_api_key":                 {},
	"changeme":                    {},
	"secret":                      {},
}

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

	// PublicAPIBaseURL is the public origin of this API, used to build
	// unsubscribe links in emails (e.g. "https://api.example.com").
	// Empty disables unsubscribe links (transactional mail still works).
	PublicAPIBaseURL string
	// EmailUnsubscribeSecret signs login-free unsubscribe links. Falls back
	// to JWTSecret when unset so no extra env var is strictly required.
	EmailUnsubscribeSecret string
	// EmailDailyLimit caps outgoing emails per calendar day to stay under
	// the Yandex 360 mailbox quota. Login codes are exempt from the cap;
	// other notifications are postponed to the next day. 0 disables the cap.
	EmailDailyLimit int

	DadataAPIKey string

	// LLM (OpenAI-compatible) config
	LLMBaseURL string
	LLMAPIKey  string
	LLMModel   string
	LLMTimeout time.Duration

	// Centrifugo config
	CentrifugoURL        string
	CentrifugoKey        string
	CentrifugoHMACSecret string

	// S3/MinIO config
	S3Endpoint        string
	S3PresignEndpoint string
	S3Region          string
	S3Bucket          string
	S3PublicBucket    string
	S3AccessKey       string
	S3SecretKey       string
	S3UsePathStyle    bool
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
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", ""),

		PublicAPIBaseURL:       getEnv("PUBLIC_API_BASE_URL", ""),
		EmailUnsubscribeSecret: getEnv("EMAIL_UNSUBSCRIBE_SECRET", ""),
		EmailDailyLimit:        getInt("EMAIL_DAILY_LIMIT", 500),

		DadataAPIKey: os.Getenv("DADATA_API_KEY"),

		LLMBaseURL: getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
		LLMAPIKey:  os.Getenv("LLM_API_KEY"),
		LLMModel:   getEnv("LLM_MODEL", "gpt-3.5-turbo"),
		LLMTimeout: getDuration("LLM_TIMEOUT", 15*time.Second),

		CentrifugoURL:        getEnv("CENTRIFUGO_URL", "http://127.0.0.1:8000"),
		CentrifugoKey:        os.Getenv("CENTRIFUGO_API_KEY"),
		CentrifugoHMACSecret: os.Getenv("CENTRIFUGO_HMAC_SECRET"),

		S3Endpoint:        getEnv("S3_ENDPOINT", ""),
		S3PresignEndpoint: getEnv("S3_PRESIGN_ENDPOINT", ""),
		S3Region:          getEnv("S3_REGION", ""),
		S3Bucket:          getEnv("S3_BUCKET", ""),
		S3PublicBucket:    getEnv("S3_PUBLIC_BUCKET", ""),
		S3AccessKey:       getEnv("S3_ACCESS_KEY", ""),
		S3SecretKey:       getEnv("S3_SECRET_KEY", ""),
		S3UsePathStyle:    getBool("S3_USE_PATH_STYLE", true),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.S3Endpoint == "" {
		return Config{}, fmt.Errorf("S3_ENDPOINT is required")
	}
	if cfg.S3Region == "" {
		return Config{}, fmt.Errorf("S3_REGION is required")
	}
	if cfg.S3Bucket == "" {
		return Config{}, fmt.Errorf("S3_BUCKET is required")
	}
	if cfg.S3PublicBucket == "" {
		return Config{}, fmt.Errorf("S3_PUBLIC_BUCKET is required")
	}
	if cfg.S3AccessKey == "" {
		return Config{}, fmt.Errorf("S3_ACCESS_KEY is required")
	}
	if cfg.S3SecretKey == "" {
		return Config{}, fmt.Errorf("S3_SECRET_KEY is required")
	}
	if cfg.S3PresignEndpoint == "" {
		cfg.S3PresignEndpoint = cfg.S3Endpoint
	}
	// The Centrifugo HMAC secret signs connection/subscription JWTs. A weak or
	// well-known value lets anyone forge tokens for arbitrary chat channels, so
	// it must be set explicitly and must not be a known placeholder.
	if cfg.CentrifugoHMACSecret == "" {
		return Config{}, fmt.Errorf("CENTRIFUGO_HMAC_SECRET is required")
	}
	if _, weak := weakSecrets[cfg.CentrifugoHMACSecret]; weak {
		return Config{}, fmt.Errorf("CENTRIFUGO_HMAC_SECRET is set to a known insecure placeholder; generate a strong random secret")
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
	// Unsubscribe links only need to be unforgeable, so reusing the JWT
	// secret is acceptable when a dedicated secret is not configured.
	if cfg.EmailUnsubscribeSecret == "" {
		cfg.EmailUnsubscribeSecret = cfg.JWTSecret
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
