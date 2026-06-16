package http

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/listing"
)

// ListingHandler serves the public listings read API.
type ListingHandler struct {
	svc          *listing.Service
	mediaBaseURL string
}

func NewListingHandler(svc *listing.Service, mediaBaseURL string) *ListingHandler {
	return &ListingHandler{svc: svc, mediaBaseURL: mediaBaseURL}
}

// Routes registers listing endpoints on the given router.
func (h *ListingHandler) Routes(r chi.Router) {
	r.Get("/", h.list)
	r.Get("/{id}", h.get)
}

// ListServices returns the amenity catalog used to populate the `services` filter.
func (h *ListingHandler) ListServices(w http.ResponseWriter, r *http.Request) {
	refs, err := h.svc.Services(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, refResponse{Items: toRefDTOs(refs)})
}

// ListCategories returns the category catalog used to populate the `category` filter.
func (h *ListingHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	refs, err := h.svc.Categories(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, refResponse{Items: toRefDTOs(refs)})
}

type refDTO struct {
	ID   int32  `json:"id"`
	Name string `json:"name"`
}

type photoDTO struct {
	ID       int32  `json:"id"`
	URL      string `json:"url"`
	Position int32  `json:"position"`
}

type listingCardDTO struct {
	ID          int32    `json:"id"`
	Address     string   `json:"address"`
	City        string   `json:"city"`
	Description string   `json:"description"`
	Price       int32    `json:"price"`
	Rooms       string   `json:"rooms"`
	Area        int32    `json:"area"`
	Lat         *float64 `json:"lat"`
	Lng         *float64 `json:"lng"`
	Views       int32    `json:"views"`
	CoverURL    string   `json:"cover_url"`
	// Rating is the average review score (0 when there are no reviews);
	// ReviewsCount is the published review count.
	Rating       float64 `json:"rating"`
	ReviewsCount int32   `json:"reviews_count"`
}

type listingDetailDTO struct {
	listingCardDTO
	NumberRoom string     `json:"number_room"`
	Photos     []photoDTO `json:"photos"`
	Services   []refDTO   `json:"services"`
	Categories []refDTO   `json:"categories"`
}

type listResponse struct {
	Items  []listingCardDTO `json:"items"`
	Total  int64            `json:"total"`
	Limit  int32            `json:"limit"`
	Offset int32            `json:"offset"`
}

type refResponse struct {
	Items []refDTO `json:"items"`
}

func (h *ListingHandler) list(w http.ResponseWriter, r *http.Request) {
	filter, msg := parseListFilter(r.URL.Query())
	if msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	res, err := h.svc.List(r.Context(), filter)
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

func (h *ListingHandler) get(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	hs, err := h.svc.Get(r.Context(), int32(id))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "listing not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, h.detailDTO(hs))
}

func (h *ListingHandler) cardDTO(hs domain.House) listingCardDTO {
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

func (h *ListingHandler) detailDTO(hs domain.House) listingDetailDTO {
	photos := make([]photoDTO, 0, len(hs.Photos))
	for _, p := range hs.Photos {
		photos = append(photos, photoDTO{ID: p.ID, URL: h.mediaURL(p.Path), Position: p.Position})
	}
	card := h.cardDTO(hs)
	if card.CoverURL == "" && len(photos) > 0 {
		card.CoverURL = photos[0].URL
	}
	return listingDetailDTO{
		listingCardDTO: card,
		NumberRoom:     hs.NumberRoom,
		Photos:         photos,
		Services:       toRefDTOs(hs.Services),
		Categories:     toRefDTOs(hs.Categories),
	}
}

func toRefDTOs(refs []domain.Ref) []refDTO {
	out := make([]refDTO, 0, len(refs))
	for _, ref := range refs {
		out = append(out, refDTO{ID: ref.ID, Name: ref.Name})
	}
	return out
}

// mediaURL turns a stored relative path into an absolute URL using MEDIA_BASE_URL.
// Legacy paths look like "../upload_files/x.jpg"; the leading "../" is stripped.
func (h *ListingHandler) mediaURL(p string) string {
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

func address(hs domain.House) string {
	return strings.TrimSpace(strings.TrimSpace(hs.Street) + " " + strings.TrimSpace(hs.HouseNumber))
}

func parseInt32(s string, def int32) int32 {
	if s == "" {
		return def
	}
	n, err := strconv.ParseInt(s, 10, 32)
	if err != nil {
		return def
	}
	return int32(n)
}

var allowedSorts = map[string]domain.ListSort{
	"":           domain.SortDefault,
	"price_asc":  domain.SortPriceAsc,
	"price_desc": domain.SortPriceDesc,
	"newest":     domain.SortNewest,
}

// parseListFilter reads listing filter query params. It returns the built
// filter, or a non-empty error message describing the first invalid param.
func parseListFilter(q url.Values) (domain.ListFilter, string) {
	f := domain.ListFilter{
		Limit:  parseInt32(q.Get("limit"), 0),
		Offset: parseInt32(q.Get("offset"), 0),
	}

	if v := strings.TrimSpace(q.Get("q")); v != "" {
		f.Query = &v
	}
	if v := strings.TrimSpace(q.Get("city")); v != "" {
		f.City = &v
	}

	for _, p := range []struct {
		key string
		dst **int32
	}{
		{"price_min", &f.PriceMin},
		{"price_max", &f.PriceMax},
		{"rooms_min", &f.RoomsMin},
		{"category", &f.Category},
	} {
		v, ok := parseOptNonNegInt32(q.Get(p.key))
		if !ok {
			return domain.ListFilter{}, "invalid " + p.key
		}
		*p.dst = v
	}

	rooms, ok := parseNonNegInt32CSV(q.Get("rooms"))
	if !ok {
		return domain.ListFilter{}, "invalid rooms"
	}
	f.Rooms = rooms

	services, ok := parseNonNegInt32CSV(q.Get("services"))
	if !ok {
		return domain.ListFilter{}, "invalid services"
	}
	f.Services = services

	sort, ok := allowedSorts[q.Get("sort")]
	if !ok {
		return domain.ListFilter{}, "invalid sort"
	}
	f.Sort = sort

	return f, ""
}

// parseOptNonNegInt32 parses an optional non-negative int32. Empty → (nil, true);
// a valid value → (&v, true); anything else → (nil, false).
func parseOptNonNegInt32(s string) (*int32, bool) {
	if s == "" {
		return nil, true
	}
	n, err := strconv.ParseInt(s, 10, 32)
	if err != nil || n < 0 {
		return nil, false
	}
	v := int32(n)
	return &v, true
}

// parseNonNegInt32CSV parses a comma-separated list of non-negative int32 values.
// Empty → (nil, true); any invalid element → (nil, false).
func parseNonNegInt32CSV(s string) ([]int32, bool) {
	if s == "" {
		return nil, true
	}
	parts := strings.Split(s, ",")
	out := make([]int32, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.ParseInt(strings.TrimSpace(p), 10, 32)
		if err != nil || n < 0 {
			return nil, false
		}
		out = append(out, int32(n))
	}
	return out, true
}
