package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

// NewRouter wires middleware and routes into an http.Handler.
func NewRouter(listingHandler *ListingHandler, authHandler *AuthHandler, bookingHandler *BookingHandler, favoriteHandler *FavoriteHandler, cityHandler *CityHandler, reviewHandler *ReviewHandler, authSvc *auth.Service) http.Handler {
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
		r.Route("/listings", func(r chi.Router) {
			r.Get("/", listingHandler.list)
			r.Get("/{id}", listingHandler.get)
			r.Get("/{id}/reviews", reviewHandler.List)

			// Authenticated endpoints under /listings
			r.Group(func(r chi.Router) {
				r.Use(AuthMiddleware(authSvc.TokenManager()))
				r.Post("/", listingHandler.create)
				r.Put("/{id}", listingHandler.update)
				r.Get("/mine", listingHandler.listMine)
				r.Post("/{id}/requests", bookingHandler.Create)
				r.Post("/{id}/reviews", reviewHandler.Create)
				r.Post("/{id}/favorite", favoriteHandler.Add)
				r.Delete("/{id}/favorite", favoriteHandler.Remove)
			})
		})

		r.Get("/services", listingHandler.ListServices)
		r.Get("/categories", listingHandler.ListCategories)
		r.Route("/auth", authHandler.Routes)
		r.Post("/cities/suggest", cityHandler.Suggest)
		r.Get("/cities/iplocate", cityHandler.IPLocate)

		// Authenticated endpoints.
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(authSvc.TokenManager()))
			r.Get("/me", authHandler.Me)
			r.Patch("/me", authHandler.UpdateMe)
			r.Delete("/me", authHandler.DeleteMe)
			r.Route("/requests", bookingHandler.Routes)
			r.Route("/favorites", favoriteHandler.Routes)
		})
	})

	return r
}
