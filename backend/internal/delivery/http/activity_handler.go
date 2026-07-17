package http

import (
	"net/http"
	"strconv"

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
		"messages":      counters.Messages,
		"bookings":      counters.Bookings,
		"incoming":      counters.Incoming,
		"listings":      counters.Listings,
		"reviews":       counters.Reviews,
		"profile":       counters.ProfileTotal(),
		"notifications": counters.Notifications,
	})
}

func (h *ActivityHandler) notifications(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	limit, offset := int32(30), int32(0)
	if raw := r.URL.Query().Get("limit"); raw != "" {
		v, err := strconv.ParseInt(raw, 10, 32)
		if err != nil || v < 1 || v > 100 {
			writeError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = int32(v)
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		v, err := strconv.ParseInt(raw, 10, 32)
		if err != nil || v < 0 {
			writeError(w, http.StatusBadRequest, "invalid offset")
			return
		}
		offset = int32(v)
	}
	items, total, err := h.repo.ListNotifications(r.Context(), userID, limit, offset)
	if err != nil {
		writeInternalError(w, r, err, "failed to load notifications")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "limit": limit, "offset": offset})
}

func (h *ActivityHandler) markNotificationRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid notification id")
		return
	}
	if err := h.repo.MarkNotificationRead(r.Context(), userID, id); err != nil {
		writeInternalError(w, r, err, "failed to mark notification read")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ActivityHandler) markAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.repo.MarkAllNotificationsRead(r.Context(), userID); err != nil {
		writeInternalError(w, r, err, "failed to mark notifications read")
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
