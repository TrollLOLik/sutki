package http

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/review"
)

// ReviewHandler exposes the listing reviews endpoints.
type ReviewHandler struct {
	svc          *review.Service
	mediaBaseURL string
}

func NewReviewHandler(svc *review.Service, mediaBaseURL string) *ReviewHandler {
	return &ReviewHandler{svc: svc, mediaBaseURL: mediaBaseURL}
}

type reviewDTO struct {
	ID              int32  `json:"id"`
	Rating          int32  `json:"rating"`
	Body            string `json:"body"`
	AuthorName      string `json:"author_name"`
	AuthorAvatarURL string `json:"author_avatar_url"`
	CreatedAt       string `json:"created_at"`
}

type reviewSummaryDTO struct {
	Average float64 `json:"average"`
	Total   int32   `json:"total"`
	// Distribution is keyed by star value ("1".."5") so the mobile distribution
	// bars can index it directly.
	Distribution map[string]int32 `json:"distribution"`
}

type reviewListResponse struct {
	Summary reviewSummaryDTO `json:"summary"`
	Items   []reviewDTO      `json:"items"`
	Total   int64            `json:"total"`
	Limit   int32            `json:"limit"`
	Offset  int32            `json:"offset"`
}

// List returns a listing's published reviews plus the rating summary.
// GET /api/v1/listings/{id}/reviews (public).
func (h *ReviewHandler) List(w http.ResponseWriter, r *http.Request) {
	houseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || houseID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.svc.List(r.Context(), int32(houseID),
		parseInt32(r.URL.Query().Get("limit"), 0), parseInt32(r.URL.Query().Get("offset"), 0))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "listing not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	items := make([]reviewDTO, 0, len(res.Items))
	for _, rv := range res.Items {
		items = append(items, h.reviewDTO(rv))
	}
	writeJSON(w, http.StatusOK, reviewListResponse{
		Summary: summaryDTO(res.Summary),
		Items:   items,
		Total:   res.Total,
		Limit:   res.Limit,
		Offset:  res.Offset,
	})
}

// Create stores a review authored by the current user for the listing.
// POST /api/v1/listings/{id}/reviews (authenticated).
func (h *ReviewHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	houseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || houseID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var body struct {
		Rating int32  `json:"rating"`
		Body   string `json:"body"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	rv, err := h.svc.Create(r.Context(), domain.NewReview{
		HouseID:  int32(houseID),
		AuthorID: userID,
		Rating:   body.Rating,
		Body:     body.Body,
	})
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidReview):
			writeError(w, http.StatusBadRequest, "invalid review")
		case errors.Is(err, domain.ErrNotFound):
			writeError(w, http.StatusNotFound, "listing not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}
	writeJSON(w, http.StatusCreated, h.reviewDTO(rv))
}

func (h *ReviewHandler) reviewDTO(rv domain.Review) reviewDTO {
	createdAt := ""
	if !rv.CreatedAt.IsZero() {
		createdAt = rv.CreatedAt.UTC().Format(time.RFC3339)
	}
	return reviewDTO{
		ID:              rv.ID,
		Rating:          rv.Rating,
		Body:            rv.Body,
		AuthorName:      rv.AuthorName,
		AuthorAvatarURL: h.mediaURL(rv.AuthorAvatarURL),
		CreatedAt:       createdAt,
	}
}

func summaryDTO(s domain.RatingSummary) reviewSummaryDTO {
	return reviewSummaryDTO{
		Average: s.Average,
		Total:   s.Total,
		Distribution: map[string]int32{
			"1": s.Distribution[0],
			"2": s.Distribution[1],
			"3": s.Distribution[2],
			"4": s.Distribution[3],
			"5": s.Distribution[4],
		},
	}
}

// mediaURL turns a stored avatar path into an absolute URL, mirroring
// ListingHandler.mediaURL. Empty values pass through unchanged.
func (h *ReviewHandler) mediaURL(p string) string {
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
