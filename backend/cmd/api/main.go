package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/TrollLOLik/sutki/backend/internal/config"
	httpdelivery "github.com/TrollLOLik/sutki/backend/internal/delivery/http"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/email"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/llm"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/storage"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/booking"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/chat"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/favorite"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/listing"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/review"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	privateStorage, err := storage.NewS3Storage(
		cfg.S3Endpoint,
		cfg.S3PresignEndpoint,
		cfg.S3Region,
		cfg.S3Bucket,
		cfg.S3AccessKey,
		cfg.S3SecretKey,
		cfg.S3UsePathStyle,
		cfg.MediaBaseURL,
	)
	if err != nil {
		log.Fatalf("failed to initialize private S3 storage: %v", err)
	}

	publicStorage, err := storage.NewS3Storage(
		cfg.S3Endpoint,
		cfg.S3PresignEndpoint,
		cfg.S3Region,
		cfg.S3PublicBucket,
		cfg.S3AccessKey,
		cfg.S3SecretKey,
		cfg.S3UsePathStyle,
		cfg.MediaBaseURL,
	)
	if err != nil {
		log.Fatalf("failed to initialize public S3 storage: %v", err)
	}

	queries := sqlc.New(pool)
	httpdelivery.ConfigureMediaFormatter(func(key string) string {
		if strings.Contains(key, "upload_files/") {
			clean := strings.TrimPrefix(key, "../")
			clean = strings.TrimLeft(clean, "/")
			if cfg.MediaBaseURL != "" {
				return strings.TrimRight(cfg.MediaBaseURL, "/") + "/" + clean
			}
			return clean
		}
		return publicStorage.PublicURL(key)
	})

	llmClient := llm.NewClient(cfg.LLMBaseURL, cfg.LLMAPIKey, cfg.LLMModel, cfg.LLMTimeout)
	aiSummarizer := llm.NewSummarizer(llmClient)

	// Durable email pipeline: DB-backed outbox + single worker draining it
	// over SMTP. Usecases only enqueue; delivery, retries and dedup live here.
	smtpSender := email.NewSMTPSender(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPFrom)
	mailer := email.NewMailer(postgres.NewEmailOutboxRepo(pool), smtpSender, int64(cfg.EmailDailyLimit))
	mailer.Start(ctx)
	emailPrefsRepo := postgres.NewEmailPrefsRepo(pool)
	notifier, err := email.NewNotifier(mailer, email.NotifierConfig{
		Prefs:              emailPrefsRepo,
		UnsubscribeBaseURL: cfg.PublicAPIBaseURL,
		UnsubscribeSecret:  cfg.EmailUnsubscribeSecret,
	})
	if err != nil {
		log.Fatalf("email templates: %v", err)
	}
	emailHandler := httpdelivery.NewEmailHandler(emailPrefsRepo, cfg.EmailUnsubscribeSecret)

	listingRepo := postgres.NewListingRepo(queries)
	listingSvc := listing.New(listingRepo, publicStorage, aiSummarizer)
	listingHandler := httpdelivery.NewListingHandler(listingSvc, cfg.MediaBaseURL)

	userRepo := postgres.NewUserRepo(queries)
	codeRepo := postgres.NewAuthCodeRepo(queries)
	refreshRepo := postgres.NewRefreshTokenRepo(queries)
	authSvc := auth.New(userRepo, codeRepo, refreshRepo, auth.Config{
		Secret:       cfg.JWTSecret,
		AccessTTL:    cfg.AccessTTL,
		RefreshTTL:   cfg.RefreshTTL,
		ExposeCode:   cfg.AuthExposeCode,
		Notifier:     notifier,
		DadataAPIKey: cfg.DadataAPIKey,
		Storage:      publicStorage,
	})
	authHandler := httpdelivery.NewAuthHandler(authSvc)

	bookingRepo := postgres.NewBookingRepo(queries)
	bookingSvc := booking.New(bookingRepo, booking.Config{
		Notifier:   notifier,
		ExposeCode: cfg.AuthExposeCode,
	})
	bookingSvc.StartCleanupJob(ctx, 1*time.Hour)
	bookingHandler := httpdelivery.NewBookingHandler(bookingSvc, cfg.MediaBaseURL)

	favoriteRepo := postgres.NewFavoriteRepo(queries)
	favoriteSvc := favorite.New(favoriteRepo)
	favoriteHandler := httpdelivery.NewFavoriteHandler(favoriteSvc, cfg.MediaBaseURL)

	reviewRepo := postgres.NewReviewRepo(queries)
	reviewSvc := review.New(reviewRepo, listingRepo, aiSummarizer, userRepo, notifier)
	reviewHandler := httpdelivery.NewReviewHandler(reviewSvc, cfg.MediaBaseURL)

	aiHandler := httpdelivery.NewAIHandler(llmClient, listingSvc, true)

	cityHandler := httpdelivery.NewCityHandler(cfg.DadataAPIKey)

	mediaHandler := httpdelivery.NewMediaHandler(privateStorage, publicStorage)

	chatRepo := postgres.NewChatRepo(queries)
	chatSvc := chat.New(chatRepo, privateStorage, chat.Config{
		CentrifugoURL: cfg.CentrifugoURL,
		CentrifugoKey: cfg.CentrifugoKey,
		HMACSecret:    cfg.CentrifugoHMACSecret,
		Notifier:      notifier,
	})
	chatHandler := httpdelivery.NewChatHandler(chatSvc)

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      httpdelivery.NewRouter(listingHandler, authHandler, bookingHandler, favoriteHandler, cityHandler, reviewHandler, chatHandler, mediaHandler, authSvc, aiHandler, emailHandler),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		// Slow-client hardening: bound idle keep-alive connections and header
		// sizes explicitly instead of relying on implicit defaults.
		IdleTimeout:    60 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1 MiB
	}

	go func() {
		log.Printf("listening on %s", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	log.Println("stopped")
}
