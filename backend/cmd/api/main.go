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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/TrollLOLik/sutki/backend/internal/config"
	httpdelivery "github.com/TrollLOLik/sutki/backend/internal/delivery/http"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/booking"
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

	queries := sqlc.New(pool)
	listingRepo := postgres.NewListingRepo(queries)
	listingSvc := listing.New(listingRepo)
	listingHandler := httpdelivery.NewListingHandler(listingSvc, cfg.MediaBaseURL)

	userRepo := postgres.NewUserRepo(queries)
	codeRepo := postgres.NewAuthCodeRepo(queries)
	refreshRepo := postgres.NewRefreshTokenRepo(queries)
	authSvc := auth.New(userRepo, codeRepo, refreshRepo, auth.Config{
		Secret:       cfg.JWTSecret,
		AccessTTL:    cfg.AccessTTL,
		RefreshTTL:   cfg.RefreshTTL,
		ExposeCode:   cfg.AuthExposeCode,
		SMTPHost:     cfg.SMTPHost,
		SMTPPort:     cfg.SMTPPort,
		SMTPUsername: cfg.SMTPUsername,
		SMTPPassword: cfg.SMTPPassword,
		SMTPFrom:     cfg.SMTPFrom,
	})
	authHandler := httpdelivery.NewAuthHandler(authSvc)

	bookingRepo := postgres.NewBookingRepo(queries)
	bookingSvc := booking.New(bookingRepo)
	bookingHandler := httpdelivery.NewBookingHandler(bookingSvc, cfg.MediaBaseURL)

	favoriteRepo := postgres.NewFavoriteRepo(queries)
	favoriteSvc := favorite.New(favoriteRepo)
	favoriteHandler := httpdelivery.NewFavoriteHandler(favoriteSvc, cfg.MediaBaseURL)

	reviewRepo := postgres.NewReviewRepo(queries)
	reviewSvc := review.New(reviewRepo)
	reviewHandler := httpdelivery.NewReviewHandler(reviewSvc, cfg.MediaBaseURL)

	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      httpdelivery.NewRouter(listingHandler, authHandler, bookingHandler, favoriteHandler, reviewHandler, authSvc),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
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
