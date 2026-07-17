package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type ActivityHandler struct {
	repo domain.UserActivityRepository
}

func NewActivityHandler(repo domain.UserActivityRepository) *ActivityHandler {
	return &ActivityHandler{repo: repo}
}

func (h *ActivityHandler) counters(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	counters, err := h.repo.Counters(r.Context(), userID)
	if err != nil {
		writeInternalError(w, r, err, "failed to load activity counters")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"messages": counters.Messages,
		"bookings": counters.Bookings,
		"incoming": counters.Incoming,
		"listings": counters.Listings,
		"reviews":  counters.Reviews,
		"profile":  counters.ProfileTotal(),
	})
}

func (h *ActivityHandler) markRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	scope := chi.URLParam(r, "scope")
	if !domain.ValidActivityScope(scope) {
		writeError(w, http.StatusBadRequest, "invalid activity scope")
		return
	}
	if err := h.repo.MarkScopeRead(r.Context(), userID, scope); err != nil {
		writeInternalError(w, r, err, "failed to mark activity read")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
