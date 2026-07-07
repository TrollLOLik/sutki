package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

// NewRouter wires middleware and routes into an http.Handler.
func NewRouter(listingHandler *ListingHandler, authHandler *AuthHandler, bookingHandler *BookingHandler, favoriteHandler *FavoriteHandler, cityHandler *CityHandler, reviewHandler *ReviewHandler, chatHandler *ChatHandler, mediaHandler *MediaHandler, authSvc *auth.Service, aiHandler *AIHandler, emailHandler *EmailHandler) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	// middleware.RealIP rewrites r.RemoteAddr from X-Forwarded-For / X-Real-IP
	// unconditionally, which would let any direct client spoof its IP (and
	// silently bypass the TRUST_PROXY_HEADERS gate in getClientIP). Only
	// enable it when the deployment explicitly trusts its proxy headers.
	if trustProxyHeaders {
		r.Use(middleware.RealIP)
	}
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(securityHeaders)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/listings", func(r chi.Router) {
			r.Get("/", listingHandler.list)
			r.Get("/{id}/availability", bookingHandler.Availability)
			r.Get("/{id}/reviews", reviewHandler.List)
			r.Get("/{id}/reviews-summary", aiHandler.GetReviewsSummary)
			r.Get("/{id}/location-summary", aiHandler.GetLocationSummary)

			// Authenticated endpoints under /listings
			r.Group(func(r chi.Router) {
				r.Use(AuthMiddleware(authSvc.TokenManager(), authSvc))
				r.Post("/", listingHandler.create)
				r.Put("/{id}", listingHandler.update)
				r.Get("/mine", listingHandler.listMine)
				r.Post("/{id}/reviews", reviewHandler.Create)
				r.Post("/{id}/favorite", favoriteHandler.Add)
				r.Delete("/{id}/favorite", favoriteHandler.Remove)
			})

			// Endpoints with optional authentication under /listings
			r.Group(func(r chi.Router) {
				r.Use(OptionalAuthMiddleware(authSvc.TokenManager(), authSvc))
				r.Get("/{id}", listingHandler.get)
				r.Post("/{id}/requests", bookingHandler.Create)
			})
		})

		r.Get("/services", listingHandler.ListServices)
		r.Get("/categories", listingHandler.ListCategories)
		r.Route("/auth", authHandler.Routes)
		r.Post("/cities/suggest", cityHandler.Suggest)
		r.Get("/cities/iplocate", cityHandler.IPLocate)
		r.Get("/users/{id}/reviews", reviewHandler.ListForUser)

		// Public/Guest endpoints
		r.Get("/guest/requests", bookingHandler.ListGuest)
		// Login-free unsubscribe link from email footers (HMAC-signed).
		r.Get("/email/unsubscribe", emailHandler.Unsubscribe)

		// Authenticated endpoints.
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(authSvc.TokenManager(), authSvc))
			r.Get("/me", authHandler.Me)
			r.Patch("/me", authHandler.UpdateMe)
			r.Delete("/me", authHandler.DeleteMe)
			r.Get("/me/sessions", authHandler.ListSessions)
			r.Delete("/me/sessions", authHandler.RevokeOtherSessions)
			r.Delete("/me/sessions/{id}", authHandler.RevokeSession)
			r.Post("/me/change-email/request-old", authHandler.RequestOldEmailCode)
			r.Post("/me/change-email/verify-old", authHandler.VerifyOldEmailCode)
			r.Post("/me/change-email/request-new", authHandler.RequestNewEmailCode)
			r.Post("/me/change-email/confirm", authHandler.ConfirmEmailChange)
			r.Get("/me/delete/check", authHandler.CheckDeleteMe)
			r.Post("/me/delete/request", authHandler.RequestDeleteMeCode)
			r.Post("/me/delete/confirm", authHandler.ConfirmDeleteMe)
			r.Get("/me/reviews/written", reviewHandler.ListMineWritten)
			r.Get("/me/reviews/received", reviewHandler.ListMineReceived)
			r.Get("/me/email-preferences", emailHandler.GetPreferences)
			r.Put("/me/email-preferences", emailHandler.UpdatePreferences)
			r.Route("/requests", func(r chi.Router) {
				// Authenticated sub-routes
				r.Group(func(r chi.Router) {
					r.Use(AuthMiddleware(authSvc.TokenManager(), authSvc))
					r.Get("/", bookingHandler.listMine)
					r.Get("/incoming", bookingHandler.listIncoming)
					r.Post("/{id}/confirm", bookingHandler.confirm)
					r.Post("/{id}/reject", bookingHandler.reject)
				})

				// Optional auth wildcard sub-routes (declared AFTER static sub-routes)
				r.Group(func(r chi.Router) {
					r.Use(OptionalAuthMiddleware(authSvc.TokenManager(), authSvc))
					r.Get("/{id}", bookingHandler.get)
					r.Post("/{id}/cancel", bookingHandler.cancel)
				})
			})
			r.Route("/favorites", favoriteHandler.Routes)
			r.Route("/chat", chatHandler.Routes)
			r.Post("/media/presign", mediaHandler.PresignUpload)
			r.Post("/ai/listing-description", aiHandler.GenerateDescription)
		})
	})

	return r
}
