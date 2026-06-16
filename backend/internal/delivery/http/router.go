package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

// NewRouter wires middleware and routes into an http.Handler.
func NewRouter(listingHandler *ListingHandler, authHandler *AuthHandler, bookingHandler *BookingHandler, favoriteHandler *FavoriteHandler, reviewHandler *ReviewHandler, authSvc *auth.Service) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/listings", listingHandler.Routes)
		r.Get("/listings/{id}/reviews", reviewHandler.List)
		r.Get("/services", listingHandler.ListServices)
		r.Get("/categories", listingHandler.ListCategories)
		r.Route("/auth", authHandler.Routes)

		// Authenticated endpoints.
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(authSvc.TokenManager()))
			r.Get("/me", authHandler.Me)
			r.Patch("/me", authHandler.UpdateMe)
			r.Post("/listings/{id}/requests", bookingHandler.Create)
			r.Post("/listings/{id}/reviews", reviewHandler.Create)
			r.Route("/requests", bookingHandler.Routes)
			r.Post("/listings/{id}/favorite", favoriteHandler.Add)
			r.Delete("/listings/{id}/favorite", favoriteHandler.Remove)
			r.Route("/favorites", favoriteHandler.Routes)
		})
	})

	return r
}
