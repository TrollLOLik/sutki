package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// weakSecrets are well-known placeholder values that must never be used for
// signing secrets in any environment.
// minSecretLength is the floor for shared secrets that sign or authorize.
// 32 chars keeps an offline attack on a captured token infeasible.
const minSecretLength = 32

// placeholderPrefixes catch the sample values shipped in .env*.example,
// which are otherwise valid-looking strings of sufficient length.
var placeholderPrefixes = []string{"replace_with", "your_", "YOUR_", "changeme", "example_"}

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
	// GlitchTipBackendDSN enables Sentry-compatible error reporting when set.
	// It is optional so local development works without an error tracker.
	GlitchTipBackendDSN string
	// Telegram receives formatted GlitchTip alerts through an authenticated
	// internal webhook. All three values must be configured together.
	TelegramBotToken               string
	TelegramChatID                 string
	GlitchTipTelegramWebhookSecret string
	TelegramTimeout                time.Duration
	AppEnvironment                 string
	// MinAppVersion is the oldest mobile build the API serves. Older builds get
	// 426 Upgrade Required instead of a confusing endpoint-level error. Empty
	// disables the gate.
	MinAppVersion string
	AppRelease    string
	JWTSecret     string
	AccessTTL     time.Duration
	RefreshTTL    time.Duration
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

	// uCaller handles both primary Flash Call and voice fallback.
	UCallerAPIURL    string
	UCallerAPIKey    string
	UCallerServiceID string
	UCallerEnabled   bool
	UCallerTimeout   time.Duration

	// Payment provider. Mock and YooKassa implement the same server-side
	// contract; switching sandbox/prod only changes credentials and endpoint.
	PaymentProvider           string
	PaymentAPIURL             string
	PaymentShopID             string
	PaymentSecret             string
	PaymentReturnURL          string
	PaymentAdminToken         string
	PaymentAdminTokenPrevious string
	PaymentCapture            bool
	PaymentProviderTimeout    time.Duration

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
	// AdminEmail receives operational alerts (moderation degraded mode,
	// review queue growth). Empty disables admin alerts.
	AdminEmail string

	DadataAPIKey    string
	OverpassURL     string
	OverpassTimeout time.Duration

	// LLM (OpenAI-compatible) config
	LLMBaseURL               string
	LLMAPIKey                string
	LLMGenerationModel       string
	LLMModerationModel       string
	LLMReviewModerationModel string
	LLMImageModerationModel  string
	LLMChatSuggestModel      string
	LLMTimeout               time.Duration

	// Media processing for chat attachments. FFmpeg lives in the worker image
	// only: the API image is distroless and cannot host it.
	FFmpegPath      string
	FFprobePath     string
	FFmpegTimeout   time.Duration
	MediaWorkDir    string
	MaxVideoSeconds int
	// MaxVideoModerationFrames limits uniformly sampled frames for one video.
	// Six frames are packed into each contact-sheet vision request.
	MaxVideoModerationFrames int
	// AttachmentModerationWorkerEnabled controls whether this process claims
	// chat-media moderation jobs. The API keeps enqueueing jobs, while the
	// dedicated media-worker is the only production process that processes them.
	AttachmentModerationWorkerEnabled bool

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
		HTTPAddr:                       getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:                    os.Getenv("DATABASE_URL"),
		MediaBaseURL:                   getEnv("MEDIA_BASE_URL", ""),
		GlitchTipBackendDSN:            getEnv("GLITCHTIP_BACKEND_DSN", ""),
		TelegramBotToken:               getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramChatID:                 getEnv("TELEGRAM_CHAT_ID", ""),
		GlitchTipTelegramWebhookSecret: getEnv("GLITCHTIP_TELEGRAM_WEBHOOK_SECRET", ""),
		TelegramTimeout:                getDuration("TELEGRAM_TIMEOUT", 10*time.Second),
		AppEnvironment:                 getEnv("APP_ENV", "development"),
		MinAppVersion:                  getEnv("MIN_APP_VERSION", ""),
		AppRelease:                     getEnv("APP_RELEASE", ""),
		JWTSecret:                      os.Getenv("JWT_SECRET"),
		AccessTTL:                      getDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTTL:                     getDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		AuthExposeCode:                 getBool("AUTH_EXPOSE_CODE", false),
		ReadTimeout:                    getDuration("HTTP_READ_TIMEOUT", 15*time.Second),
		WriteTimeout:                   getDuration("HTTP_WRITE_TIMEOUT", 75*time.Second),

		SMTPHost:     getEnv("SMTP_HOST", "smtp.yandex.ru"),
		SMTPPort:     getInt("SMTP_PORT", 465),
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", ""),

		UCallerAPIURL:    getEnv("UCALLER_API_URL", "https://api.ucaller.ru"),
		UCallerAPIKey:    getEnv("UCALLER_API_KEY", ""),
		UCallerServiceID: getEnv("UCALLER_SERVICE_ID", ""),
		UCallerEnabled:   getBool("UCALLER_ENABLED", false),
		UCallerTimeout:   getDuration("UCALLER_TIMEOUT", 10*time.Second),

		PaymentProvider:           getEnv("PAYMENT_PROVIDER", "mock"),
		PaymentAPIURL:             getEnv("PAYMENT_API_URL", "https://api.yookassa.ru/v3"),
		PaymentShopID:             getEnv("PAYMENT_SHOP_ID", ""),
		PaymentSecret:             getEnv("PAYMENT_SECRET", ""),
		PaymentReturnURL:          getEnv("PAYMENT_RETURN_URL", "sutki://payments/return"),
		PaymentAdminToken:         getEnv("PAYMENT_ADMIN_TOKEN", ""),
		PaymentAdminTokenPrevious: getEnv("PAYMENT_ADMIN_TOKEN_PREVIOUS", ""),
		PaymentCapture:            getBool("PAYMENT_CAPTURE", true),
		PaymentProviderTimeout:    getDuration("PAYMENT_PROVIDER_TIMEOUT", 15*time.Second),

		PublicAPIBaseURL:       getEnv("PUBLIC_API_BASE_URL", ""),
		EmailUnsubscribeSecret: getEnv("EMAIL_UNSUBSCRIBE_SECRET", ""),
		EmailDailyLimit:        getInt("EMAIL_DAILY_LIMIT", 500),
		AdminEmail:             getEnv("ADMIN_EMAIL", ""),

		DadataAPIKey:    os.Getenv("DADATA_API_KEY"),
		OverpassURL:     getEnv("OVERPASS_URL", "https://overpass-api.de/api/interpreter"),
		OverpassTimeout: getDuration("OVERPASS_TIMEOUT", 12*time.Second),

		LLMBaseURL:               getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
		LLMAPIKey:                os.Getenv("LLM_API_KEY"),
		LLMGenerationModel:       getEnv("LLM_GENERATION_MODEL", getEnv("LLM_MODEL", "openai/gpt-oss-120b")),
		LLMModerationModel:       getEnv("LLM_MODERATION_MODEL", getEnv("LLM_MODEL", "openai/gpt-oss-120b")),
		LLMReviewModerationModel: getEnv("LLM_REVIEW_MODERATION_MODEL", getEnv("LLM_MODERATION_MODEL", getEnv("LLM_MODEL", "openai/gpt-oss-120b"))),
		LLMImageModerationModel:  getEnv("LLM_IMAGE_MODERATION_MODEL", "Qwen/Qwen3.6-35B-A3B"),
		// Отдельная модель под подсказки в чате: это самый частый и самый
		// дешёвый по объёму вызов, и менять её не должно тянуть за собой
		// генерацию описаний. Фоллбэк — общая LLM_MODEL.
		LLMChatSuggestModel: getEnv("LLM_CHAT_SUGGEST_MODEL", getEnv("LLM_MODEL", "openai/gpt-oss-120b")),
		LLMTimeout:          getDuration("LLM_TIMEOUT", 15*time.Second),

		FFmpegPath:  getEnv("FFMPEG_PATH", "ffmpeg"),
		FFprobePath: getEnv("FFPROBE_PATH", "ffprobe"),
		// One ffmpeg invocation. Measured cost on a 30s 720p clip is ~0.5s, so a
		// minute is a generous ceiling that still stops a malformed file from
		// pinning a core on a two-core box.
		FFmpegTimeout: getDuration("FFMPEG_TIMEOUT", 60*time.Second),
		// Should point at a size-capped tmpfs: frames and downloaded videos are
		// transient, and a burst must not be able to fill the disk.
		MediaWorkDir:                      getEnv("MEDIA_WORK_DIR", ""),
		MaxVideoSeconds:                   getInt("MAX_VIDEO_SECONDS", 60),
		MaxVideoModerationFrames:          getInt("MAX_VIDEO_MODERATION_FRAMES", 12),
		AttachmentModerationWorkerEnabled: getBool("ATTACHMENT_MODERATION_WORKER_ENABLED", true),

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
	if cfg.UCallerEnabled && (cfg.UCallerAPIKey == "" || cfg.UCallerServiceID == "") {
		return Config{}, fmt.Errorf("UCALLER_API_KEY and UCALLER_SERVICE_ID are required when UCALLER_ENABLED=true")
	}
	if cfg.PaymentProvider != "mock" && cfg.PaymentProvider != "yookassa" {
		return Config{}, fmt.Errorf("PAYMENT_PROVIDER must be mock or yookassa")
	}
	if cfg.PaymentProvider == "yookassa" && (cfg.PaymentShopID == "" || cfg.PaymentSecret == "") {
		return Config{}, fmt.Errorf("PAYMENT_SHOP_ID and PAYMENT_SECRET are required for yookassa")
	}
	if cfg.PaymentAdminTokenPrevious != "" && cfg.PaymentAdminToken == "" {
		return Config{}, fmt.Errorf("PAYMENT_ADMIN_TOKEN must be set while PAYMENT_ADMIN_TOKEN_PREVIOUS is configured")
	}
	telegramValues := 0
	for _, value := range []string{cfg.TelegramBotToken, cfg.TelegramChatID, cfg.GlitchTipTelegramWebhookSecret} {
		if value != "" {
			telegramValues++
		}
	}
	if telegramValues != 0 && telegramValues != 3 {
		return Config{}, fmt.Errorf("TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and GLITCHTIP_TELEGRAM_WEBHOOK_SECRET must be configured together")
	}
	if cfg.GlitchTipTelegramWebhookSecret != "" && len(cfg.GlitchTipTelegramWebhookSecret) < 32 {
		return Config{}, fmt.Errorf("GLITCHTIP_TELEGRAM_WEBHOOK_SECRET must be at least 32 characters")
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

	// --- Production hardening -------------------------------------------
	// Deliberately scoped to production: development keeps its convenience
	// defaults, while a misconfigured production deployment refuses to start
	// rather than starting insecurely.
	if cfg.AppEnvironment == "production" {
		if cfg.PaymentProvider == "mock" {
			return Config{}, fmt.Errorf("PAYMENT_PROVIDER=mock is not allowed when APP_ENV=production")
		}
		if cfg.AuthExposeCode {
			return Config{}, fmt.Errorf("AUTH_EXPOSE_CODE must be false when APP_ENV=production")
		}
		// Empty values are intentionally skipped: each optional secret already
		// fails closed on its own when unset (an empty admin token authorizes
		// nobody). What must not happen is a weak or sample value being trusted.
		for _, s := range []struct{ name, value string }{
			{"JWT_SECRET", cfg.JWTSecret},
			{"CENTRIFUGO_HMAC_SECRET", cfg.CentrifugoHMACSecret},
			{"CENTRIFUGO_API_KEY", cfg.CentrifugoKey},
			{"PAYMENT_ADMIN_TOKEN", cfg.PaymentAdminToken},
			{"PAYMENT_ADMIN_TOKEN_PREVIOUS", cfg.PaymentAdminTokenPrevious},
		} {
			if s.value == "" {
				continue
			}
			if _, weak := weakSecrets[s.value]; weak {
				return Config{}, fmt.Errorf("%s is set to a known insecure placeholder; generate a strong random secret", s.name)
			}
			for _, prefix := range placeholderPrefixes {
				if strings.HasPrefix(s.value, prefix) {
					return Config{}, fmt.Errorf("%s still holds a sample placeholder value; generate a strong random secret", s.name)
				}
			}
			if len(s.value) < minSecretLength {
				return Config{}, fmt.Errorf("%s must be at least %d characters", s.name, minSecretLength)
			}
		}
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
