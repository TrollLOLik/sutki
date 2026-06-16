package http

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/favorite"
)

// FavoriteHandler serves the authenticated favorites (saved listings) API.
type FavoriteHandler struct {
	svc          *favorite.Service
	mediaBaseURL string
}

func NewFavoriteHandler(svc *favorite.Service, mediaBaseURL string) *FavoriteHandler {
	return &FavoriteHandler{svc: svc, mediaBaseURL: mediaBaseURL}
}

// Routes registers the /favorites endpoints (mounted behind AuthMiddleware).
// Add/Remove live under the listing they target (see Add/Remove), wired
// separately in the router.
func (h *FavoriteHandler) Routes(r chi.Router) {
	r.Get("/", h.list)
	r.Get("/ids", h.ids)
}

type favoriteIDsResponse struct {
	IDs []int32 `json:"ids"`
}

// Add handles POST /api/v1/listings/{id}/favorite: the authenticated user adds
// the listing to their favorites. Idempotent; responds 204.
func (h *FavoriteHandler) Add(w http.ResponseWriter, r *http.Request) {
	userID, houseID, ok := h.actorAndID(w, r)
	if !ok {
		return
	}
	if err := h.svc.Add(r.Context(), userID, houseID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "listing not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Remove handles DELETE /api/v1/listings/{id}/favorite: the authenticated user
// removes the listing from their favorites. Idempotent; responds 204.
func (h *FavoriteHandler) Remove(w http.ResponseWriter, r *http.Request) {
	userID, houseID, ok := h.actorAndID(w, r)
	if !ok {
		return
	}
	if err := h.svc.Remove(r.Context(), userID, houseID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FavoriteHandler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	res, err := h.svc.List(r.Context(), userID, parseInt32(r.URL.Query().Get("limit"), 0), parseInt32(r.URL.Query().Get("offset"), 0))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	items := make([]listingCardDTO, 0, len(res.Items))
	for _, hs := range res.Items {
		items = append(items, h.cardDTO(hs))
	}
	writeJSON(w, http.StatusOK, listResponse{
		Items:  items,
		Total:  res.Total,
		Limit:  res.Limit,
		Offset: res.Offset,
	})
}

func (h *FavoriteHandler) ids(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	ids, err := h.svc.IDs(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, favoriteIDsResponse{IDs: ids})
}

func (h *FavoriteHandler) actorAndID(w http.ResponseWriter, r *http.Request) (int32, int32, bool) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return 0, 0, false
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return 0, 0, false
	}
	return userID, int32(id), true
}

func (h *FavoriteHandler) cardDTO(hs domain.House) listingCardDTO {
	return listingCardDTO{
		ID:           hs.ID,
		Address:      address(hs),
		City:         hs.City,
		Description:  hs.Description,
		Price:        hs.Price,
		Rooms:        hs.CountRoom,
		Area:         hs.Area,
		Lat:          hs.Lat,
		Lng:          hs.Lng,
		Views:        hs.Views,
		CoverURL:     h.mediaURL(hs.CoverPath),
		Rating:       hs.Rating,
		ReviewsCount: hs.ReviewsCount,
	}
}

// mediaURL mirrors ListingHandler.mediaURL for favorite listing covers.
func (h *FavoriteHandler) mediaURL(p string) string {
	if p == "" {
		return ""
	}
	if h.mediaBaseURL == "" {
		return p
	}
	clean := strings.TrimPrefix(p, "../")
	clean = strings.TrimLeft(clean, "/")
	return strings.TrimRight(h.mediaBaseURL, "/") + "/" + clean
}
