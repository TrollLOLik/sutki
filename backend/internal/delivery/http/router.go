package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

// NewRouter wires middleware and routes into an http.Handler.
func NewRouter(listingHandler *ListingHandler, authHandler *AuthHandler, bookingHandler *BookingHandler, favoriteHandler *FavoriteHandler, cityHandler *CityHandler, reviewHandler *ReviewHandler, chatHandler *ChatHandler, mediaHandler *MediaHandler, activityHandler *ActivityHandler, authSvc *auth.Service, aiHandler *AIHandler, emailHandler *EmailHandler, paymentHandler *PaymentHandler, promotionHandler *PromotionHandler, opsWebhookHandler *OpsWebhookHandler, minAppVersion string, errorTracking func(http.Handler) http.Handler) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	// Remove the internal webhook secret before middleware.Logger sees the URL.
	r.Use(captureOpsWebhookToken)
	// middleware.RealIP rewrites r.RemoteAddr from X-Forwarded-For / X-Real-IP
	// unconditionally, which would let any direct client spoof its IP (and
	// silently bypass the TRUST_PROXY_HEADERS gate in getClientIP). Only
	// enable it when the deployment explicitly trusts its proxy headers.
	if trustProxyHeaders {
		r.Use(middleware.RealIP)
	}
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	if errorTracking != nil {
		// The tracker must be inside Recoverer: it reports the panic, repanics,
		// then Chi turns that panic into the normal HTTP 500 response.
		r.Use(errorTracking)
	}
	r.Use(securityHeaders)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Deliberately outside /api/v1 and therefore outside the version gate: a
	// client that is too old still has to be able to ask what "new enough"
	// means, and asking must never itself return 426.
	r.Get("/app-version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"minimum_supported_version": minAppVersion})
	})
	if opsWebhookHandler != nil {
		r.Post(glitchTipTelegramPath, opsWebhookHandler.GlitchTipTelegram)
	}

	r.Route("/api/v1", func(r chi.Router) {
		// Turns "old build hits a tightened endpoint" from a mystery 4xx on
		// some form into an explicit, actionable 426. Not a security control —
		// a client controls its own version header — so nothing below may rely
		// on it.
		r.Use(minAppVersionGate(minAppVersion))
		r.Route("/listings", func(r chi.Router) {
			r.Get("/", listingHandler.list)
			r.Get("/map-clusters", listingHandler.mapClusters)
			r.Get("/{id}/availability", bookingHandler.Availability)
			r.Get("/{id}/reviews", reviewHandler.List)
			r.Get("/{id}/reviews-summary", aiHandler.GetReviewsSummary)
			r.Get("/{id}/location-summary", aiHandler.GetLocationSummary)

			// Authenticated endpoints under /listings
			r.Group(func(r chi.Router) {
				r.Use(AuthMiddleware(authSvc.TokenManager(), authSvc))
				r.Post("/", listingHandler.create)
				r.Put("/{id}", listingHandler.update)
				r.Post("/{id}/unpublish", listingHandler.unpublish)
				r.Post("/{id}/publish", listingHandler.publish)
				r.Get("/mine", listingHandler.listMine)
				r.Post("/{id}/favorite", favoriteHandler.Add)
				r.Delete("/{id}/favorite", favoriteHandler.Remove)
				r.Post("/{id}/promotions/checkout", promotionHandler.Checkout)
				r.Get("/{id}/promotions", promotionHandler.List)
			})

			// Endpoints with optional authentication under /listings
			r.Group(func(r chi.Router) {
				r.Use(OptionalAuthMiddleware(authSvc.TokenManager(), authSvc))
				r.Get("/{id}", listingHandler.get)
				r.Post("/{id}/views", listingHandler.recordView)
				r.Post("/{id}/requests", bookingHandler.Create)
			})
		})

		r.Get("/services", listingHandler.ListServices)
		r.Get("/categories", listingHandler.ListCategories)
		r.Route("/auth", authHandler.Routes)
		r.Post("/cities/suggest", cityHandler.Suggest)
		r.Get("/cities/iplocate", cityHandler.IPLocate)
		r.Get("/users/{id}", authHandler.PublicProfile)
		r.Get("/users/{id}/reviews", reviewHandler.ListForUser)
		r.Get("/users/{id}/host-response-stats", chatHandler.HostResponseStats)

		// Public/Guest endpoints
		r.Get("/guest/requests", bookingHandler.ListGuest)
		// Login-free unsubscribe link from email footers (HMAC-signed).
		r.Get("/email/unsubscribe", emailHandler.Unsubscribe)
		r.Get("/payment-products", paymentHandler.Products)
		r.Post("/webhooks/yookassa", paymentHandler.Webhook)
		r.Post("/admin/payments/{id}/refunds", paymentHandler.Refund)
		r.Post("/admin/payments/mock/{provider_id}/status", paymentHandler.MockSetStatus)

		// Authenticated endpoints.
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(authSvc.TokenManager(), authSvc))
			r.Get("/me", authHandler.Me)
			r.Get("/me/activity", activityHandler.counters)
			r.Post("/me/activity/{scope}/read", activityHandler.markRead)
			r.Get("/me/notifications", activityHandler.notifications)
			r.Get("/me/viewed-listings/ids", listingHandler.viewedIDs)
			r.Post("/me/viewed-listings/import", listingHandler.importViewed)
			r.Post("/me/notifications/read", activityHandler.markAllNotificationsRead)
			r.Post("/me/notifications/{id}/read", activityHandler.markNotificationRead)
			r.Patch("/me", authHandler.UpdateMe)
			r.Delete("/me", authHandler.DeleteMe)
			r.Get("/me/sessions", authHandler.ListSessions)
			r.Delete("/me/sessions", authHandler.RevokeOtherSessions)
			r.Delete("/me/sessions/{id}", authHandler.RevokeSession)
			// Factor-agnostic re-authentication: proves control of whatever
			// factor the account already has (verified phone, else email)
			// before any of the change-* flows below may run. This replaced an
			// email-only predecessor, which could only ever prove a mailbox and
			// so was useless to — and a downgrade path for — phone accounts.
			r.Post("/me/reauth/request", authHandler.RequestReauthCode)
			r.Post("/me/reauth/fallback", authHandler.ReauthFallback)
			r.Post("/me/reauth/verify", authHandler.VerifyReauthCode)
			r.Post("/me/change-email/request-new", authHandler.RequestNewEmailCode)
			r.Post("/me/change-email/confirm", authHandler.ConfirmEmailChange)
			r.Post("/me/change-phone/request", authHandler.changePhoneRequest)
			r.Post("/me/change-phone/fallback", authHandler.changePhoneFallback)
			r.Post("/me/change-phone/confirm", authHandler.changePhoneConfirm)
			r.Get("/me/delete/check", authHandler.CheckDeleteMe)
			r.Post("/me/delete/request", authHandler.RequestDeleteMeCode)
			r.Post("/me/delete/confirm", authHandler.ConfirmDeleteMe)
			r.Get("/me/reviews/written", reviewHandler.ListMineWritten)
			r.Get("/me/reviews/received", reviewHandler.ListMineReceived)
			r.Get("/me/review-eligibility", reviewHandler.ListEligibility)
			r.Post("/reviews/{id}/reply", reviewHandler.CreateReply)
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
					r.Post("/{id}/review", reviewHandler.Create)
					r.Get("/{id}/review-eligibility", reviewHandler.Eligibility)
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
			r.Post("/media/listings/moderate", mediaHandler.ModerateListingImages)
			r.Post("/ai/listing-description", aiHandler.GenerateDescription)
			r.Post("/payments/checkout", paymentHandler.Checkout)
			r.Get("/payments/{id}", paymentHandler.Get)
			r.Post("/payments/{id}/mock-confirm", paymentHandler.MockConfirm)
		})
	})

	return r
}
