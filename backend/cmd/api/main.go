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

	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/TrollLOLik/sutki/backend/internal/config"
	httpdelivery "github.com/TrollLOLik/sutki/backend/internal/delivery/http"
	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/email"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/llm"
	paymentinfra "github.com/TrollLOLik/sutki/backend/internal/infrastructure/payment"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/poi"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/realtime"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/storage"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/telegram"
	"github.com/TrollLOLik/sutki/backend/internal/infrastructure/ucaller"
	"github.com/TrollLOLik/sutki/backend/internal/observability"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/booking"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/chat"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/favorite"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/listing"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/moderation"
	paymentuc "github.com/TrollLOLik/sutki/backend/internal/usecase/payment"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/promotion"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/review"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	flushErrorTracking := initErrorTracking(cfg)
	defer flushErrorTracking()
	if len(os.Args) == 2 && os.Args[1] == "--error-tracking-smoke-test" {
		if cfg.GlitchTipBackendDSN == "" {
			log.Fatal("error tracking smoke test requires GLITCHTIP_BACKEND_DSN")
		}
		runID := time.Now().UTC().Format("20060102T150405.000000000Z")
		observability.CaptureSmokeTest(context.Background(), runID)
		if !observability.Flush(10 * time.Second) {
			log.Fatal("GlitchTip smoke event delivery timed out")
		}
		log.Println("GlitchTip smoke exception delivered to transport")
		return
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
	userEvents := realtime.NewPublisher(pool, cfg.CentrifugoURL, cfg.CentrifugoKey)
	activityHandler := httpdelivery.NewActivityHandler(userEvents)
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

	llmClientGen := llm.NewClient(cfg.LLMBaseURL, cfg.LLMAPIKey, cfg.LLMGenerationModel, cfg.LLMTimeout)
	llmClientMod := llm.NewClient(cfg.LLMBaseURL, cfg.LLMAPIKey, cfg.LLMModerationModel, cfg.LLMTimeout)
	llmClientReviewMod := llm.NewClient(cfg.LLMBaseURL, cfg.LLMAPIKey, cfg.LLMReviewModerationModel, cfg.LLMTimeout)
	aiSummarizer := llm.NewSummarizer(llmClientGen)

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

	// Listing moderation: synchronous prefilter on create/update plus a
	// background LLM verdict worker with circuit breaker + degraded mode.
	moderationRepo := postgres.NewModerationRepo(pool)
	var adminAlerter moderation.AdminAlerter
	if a := email.NewAdminNotifier(notifier, cfg.AdminEmail); a != nil {
		adminAlerter = a
	}
	moderationSvc := moderation.New(moderationRepo, llmClientMod, adminAlerter, notifier)
	moderationSvc.SetUserEvents(userEvents)
	moderationSvc.StartWorker(ctx)

	listingRepo := postgres.NewListingRepo(queries)
	listingViewRepo := postgres.NewListingViewRepo(pool)
	moderationSvc.SetPhotoPipeline(listingRepo, publicStorage)
	locationSummaryJobRepo := postgres.NewLocationSummaryJobRepo(pool)
	nearbyPOIs := poi.NewOverpass(cfg.OverpassURL, cfg.OverpassTimeout)
	listingSvc := listing.New(listingRepo, listingViewRepo, publicStorage, aiSummarizer, moderationSvc, locationSummaryJobRepo, nearbyPOIs)
	listingSvc.SetUserEvents(userEvents)
	listingSvc.StartLocationSummaryWorker(ctx)
	listingSvc.StartMediaIntegrityWorker(ctx, 6*time.Hour)
	listingHandler := httpdelivery.NewListingHandler(listingSvc, cfg.MediaBaseURL)

	ucallerClient := ucaller.NewClient(ucaller.Config{
		APIURL: cfg.UCallerAPIURL, APIKey: cfg.UCallerAPIKey, ServiceID: cfg.UCallerServiceID,
		Enabled: cfg.UCallerEnabled, Timeout: cfg.UCallerTimeout,
	})

	userRepo := postgres.NewUserRepo(queries)
	var paymentProvider domain.PaymentProvider
	if cfg.PaymentProvider == "yookassa" {
		paymentProvider, err = paymentinfra.NewYookassaProvider(paymentinfra.YookassaConfig{
			APIURL: cfg.PaymentAPIURL, ShopID: cfg.PaymentShopID, Secret: cfg.PaymentSecret,
			Timeout: cfg.PaymentProviderTimeout,
		})
		if err != nil {
			log.Fatalf("payment provider: %v", err)
		}
	} else {
		paymentProvider = paymentinfra.NewMockProvider()
		log.Println("payment provider: MOCK mode; no real money is charged")
	}
	paymentRepo := postgres.NewPaymentRepo(pool)
	paymentSvc := paymentuc.New(paymentRepo, userRepo, paymentProvider, nil, paymentuc.Config{
		ReturnURL: cfg.PaymentReturnURL, AdminToken: cfg.PaymentAdminToken,
		AdminTokenPrevious: cfg.PaymentAdminTokenPrevious, Capture: cfg.PaymentCapture,
	})
	promotionSvc := promotion.New(postgres.NewPromotionRepo(pool), paymentSvc)
	paymentSvc.SetActivationHandler(promotionSvc)
	promotionSvc.StartExpiryWorker(ctx)
	paymentSvc.StartWebhookWorker(ctx)
	paymentHandler := httpdelivery.NewPaymentHandler(paymentSvc)
	promotionHandler := httpdelivery.NewPromotionHandler(promotionSvc)
	codeRepo := postgres.NewAuthCodeRepo(queries)
	refreshRepo := postgres.NewRefreshTokenRepo(queries)
	phoneChallengeRepo := postgres.NewPhoneChallengeRepo(pool)
	authSvc := auth.New(userRepo, codeRepo, refreshRepo, auth.Config{
		Secret:          cfg.JWTSecret,
		AccessTTL:       cfg.AccessTTL,
		RefreshTTL:      cfg.RefreshTTL,
		ExposeCode:      cfg.AuthExposeCode,
		Notifier:        notifier,
		PhoneCaller:     ucallerClient,
		PhoneChallenges: phoneChallengeRepo,
		DadataAPIKey:    cfg.DadataAPIKey,
		Storage:         publicStorage,
	})
	authSvc.StartPhoneChallengeReaper(ctx, time.Minute)
	authHandler := httpdelivery.NewAuthHandler(authSvc)

	// Chat is constructed before booking: booking posts system status cards
	// into owner-guest conversations via the ChatSystemPoster interface.
	chatRepo := postgres.NewChatRepo(queries)
	chatSvc := chat.New(chatRepo, privateStorage, chat.Config{
		CentrifugoURL: cfg.CentrifugoURL,
		CentrifugoKey: cfg.CentrifugoKey,
		HMACSecret:    cfg.CentrifugoHMACSecret,
		Notifier:      notifier,
	})
	chatHandler := httpdelivery.NewChatHandler(chatSvc)

	bookingRepo := postgres.NewBookingRepo(queries)
	bookingSvc := booking.New(bookingRepo, booking.Config{
		Notifier:   notifier,
		Chat:       chatSvc,
		UserEvents: userEvents,
		ExposeCode: cfg.AuthExposeCode,
	})
	bookingSvc.StartCleanupJob(ctx, 1*time.Hour)
	bookingHandler := httpdelivery.NewBookingHandler(bookingSvc, cfg.MediaBaseURL)

	// When email verification links guest requests to a new user, booking
	// notifies the listing owners (email + chat card).
	authSvc.SetGuestRequestsLinkedHook(bookingSvc.HandleGuestRequestsLinked)

	favoriteRepo := postgres.NewFavoriteRepo(queries)
	favoriteSvc := favorite.New(favoriteRepo)
	favoriteHandler := httpdelivery.NewFavoriteHandler(favoriteSvc, cfg.MediaBaseURL)

	reviewRepo := postgres.NewReviewRepo(pool, queries)
	reviewSvc := review.New(reviewRepo, listingRepo, aiSummarizer, userRepo, notifier, llmClientReviewMod)
	reviewSvc.SetUserEvents(userEvents)
	reviewSvc.StartWorker(ctx)
	reviewHandler := httpdelivery.NewReviewHandler(reviewSvc, cfg.MediaBaseURL)

	aiHandler := httpdelivery.NewAIHandler(llmClientGen, listingSvc, true)

	cityHandler := httpdelivery.NewCityHandler(cfg.DadataAPIKey)

	mediaHandler := httpdelivery.NewMediaHandler(privateStorage, publicStorage)
	var opsWebhookHandler *httpdelivery.OpsWebhookHandler
	if cfg.TelegramBotToken != "" {
		telegramClient := telegram.NewClient(telegram.Config{
			BotToken: cfg.TelegramBotToken,
			ChatID:   cfg.TelegramChatID,
			Timeout:  cfg.TelegramTimeout,
		})
		opsWebhookHandler = httpdelivery.NewOpsWebhookHandler(telegramClient, cfg.GlitchTipTelegramWebhookSecret)
		log.Println("GlitchTip Telegram alert bridge enabled")
	}

	errorTracking := newErrorTrackingMiddleware(cfg.GlitchTipBackendDSN != "")
	handler := httpdelivery.NewRouter(listingHandler, authHandler, bookingHandler, favoriteHandler, cityHandler, reviewHandler, chatHandler, mediaHandler, activityHandler, authSvc, aiHandler, emailHandler, paymentHandler, promotionHandler, opsWebhookHandler, errorTracking)

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      handler,
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

func newErrorTrackingMiddleware(enabled bool) func(http.Handler) http.Handler {
	if !enabled {
		return nil
	}
	return sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle
}

func initErrorTracking(cfg config.Config) func() {
	flush, err := observability.Init(observability.Config{
		DSN:         cfg.GlitchTipBackendDSN,
		Environment: cfg.AppEnvironment,
		Release:     cfg.AppRelease,
	})
	if err != nil {
		log.Printf("GlitchTip disabled: initialize Sentry client: %v", err)
		return func() {}
	}
	if cfg.GlitchTipBackendDSN != "" {
		log.Printf("GlitchTip error reporting enabled (environment=%s, release=%s)", cfg.AppEnvironment, cfg.AppRelease)
	}
	return flush
}
