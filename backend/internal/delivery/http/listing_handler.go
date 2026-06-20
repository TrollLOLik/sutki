package http

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

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
	MaxGuests   *int32   `json:"max_guests"`
	Views       int32    `json:"views"`
	CoverURL    string   `json:"cover_url"`
	// Rating is the average review score (0 when there are no reviews);
	// ReviewsCount is the published review count.
	Rating       float64 `json:"rating"`
	ReviewsCount int32   `json:"reviews_count"`
}

type listingDetailDTO struct {
	listingCardDTO
	OwnerID            int32      `json:"owner_id"`
	OwnerName          string     `json:"owner_name"`
	OwnerSurname       string     `json:"owner_surname"`
	OwnerPhone         string     `json:"owner_phone"`
	OwnerAvatarURL     string     `json:"owner_avatar_url"`
	OwnerRating        float64    `json:"owner_rating"`
	OwnerReviewsCount  int32      `json:"owner_reviews_count"`
	OwnerListingsCount int32      `json:"owner_listings_count"`
	OwnerIsVerified    bool       `json:"owner_is_verified"`
	Street             string     `json:"street"`
	HouseNumber        string     `json:"house_number"`
	NumberRoom         string     `json:"number_room"`
	Photos             []photoDTO `json:"photos"`
	Services           []refDTO   `json:"services"`
	Categories         []refDTO   `json:"categories"`
	CheckInAfter       *string    `json:"check_in_after"`
	CheckOutBefore     *string    `json:"check_out_before"`
	SmokingAllowed     *string    `json:"smoking_allowed"`
	PetsAllowed        *string    `json:"pets_allowed"`
	ChildrenAllowed    *string    `json:"children_allowed"`
	EventsAllowed      *string    `json:"events_allowed"`
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

type createListingRequest struct {
	Street          string   `json:"street"`
	HouseNumber     string   `json:"house_number"`
	City            string   `json:"city"`
	Description     string   `json:"description"`
	Price           int32    `json:"price"`
	CountRoom       string   `json:"count_room"`
	NumberRoom      *string  `json:"number_room"`
	Area            int32    `json:"area"`
	Lat             *float64 `json:"lat"`
	Lng             *float64 `json:"lng"`
	MaxGuests       *int32   `json:"max_guests"`
	ServiceIDs      []int32  `json:"service_ids"`
	CategoryIDs     []int32  `json:"category_ids"`
	CheckInAfter    *string  `json:"check_in_after"`
	CheckOutBefore  *string  `json:"check_out_before"`
	SmokingAllowed  *string  `json:"smoking_allowed"`
	PetsAllowed     *string  `json:"pets_allowed"`
	ChildrenAllowed *string  `json:"children_allowed"`
	EventsAllowed   *string  `json:"events_allowed"`
}

// create handles POST /api/v1/listings: the authenticated user publishes a new
// listing. OwnerID comes from the session, not the body.
func (h *ListingHandler) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body createListingRequest
	if !decodeJSON(w, r, &body) {
		return
	}
	in := domain.NewHouse{
		OwnerID:         userID,
		Street:          body.Street,
		HouseNumber:     body.HouseNumber,
		City:            body.City,
		Description:     body.Description,
		Price:           body.Price,
		CountRoom:       body.CountRoom,
		NumberRoom:      body.NumberRoom,
		Area:            body.Area,
		Lat:             body.Lat,
		Lng:             body.Lng,
		MaxGuests:       body.MaxGuests,
		ServiceIDs:      body.ServiceIDs,
		CategoryIDs:     body.CategoryIDs,
		CheckInAfter:    body.CheckInAfter,
		CheckOutBefore:  body.CheckOutBefore,
		SmokingAllowed:  body.SmokingAllowed,
		PetsAllowed:     body.PetsAllowed,
		ChildrenAllowed: body.ChildrenAllowed,
		EventsAllowed:   body.EventsAllowed,
	}
	hs, err := h.svc.Create(r.Context(), in)
	if err != nil {
		if errors.Is(err, listing.ErrInvalidListing) {
			writeError(w, http.StatusBadRequest, "invalid listing")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, h.detailDTO(hs))
}

// update handles PUT /api/v1/listings/{id}: the authenticated user updates their own listing.
func (h *ListingHandler) update(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var body createListingRequest
	if !decodeJSON(w, r, &body) {
		return
	}
	in := domain.NewHouse{
		OwnerID:         userID,
		Street:          body.Street,
		HouseNumber:     body.HouseNumber,
		City:            body.City,
		Description:     body.Description,
		Price:           body.Price,
		CountRoom:       body.CountRoom,
		NumberRoom:      body.NumberRoom,
		Area:            body.Area,
		Lat:             body.Lat,
		Lng:             body.Lng,
		MaxGuests:       body.MaxGuests,
		ServiceIDs:      body.ServiceIDs,
		CategoryIDs:     body.CategoryIDs,
		CheckInAfter:    body.CheckInAfter,
		CheckOutBefore:  body.CheckOutBefore,
		SmokingAllowed:  body.SmokingAllowed,
		PetsAllowed:     body.PetsAllowed,
		ChildrenAllowed: body.ChildrenAllowed,
		EventsAllowed:   body.EventsAllowed,
	}
	hs, err := h.svc.Update(r.Context(), int32(id), in)
	if err != nil {
		switch {
		case errors.Is(err, listing.ErrInvalidListing):
			writeError(w, http.StatusBadRequest, "invalid listing")
		case errors.Is(err, domain.ErrNotFound):
			writeError(w, http.StatusNotFound, "listing not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}
	writeJSON(w, http.StatusOK, h.detailDTO(hs))
}

// listMine handles GET /api/v1/listings/mine: the authenticated user's own
// listings (any status), newest first.
func (h *ListingHandler) listMine(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	res, err := h.svc.ListMine(
		r.Context(),
		userID,
		parseInt32(r.URL.Query().Get("limit"), 0),
		parseInt32(r.URL.Query().Get("offset"), 0),
	)
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
		MaxGuests:    hs.MaxGuests,
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
		listingCardDTO:     card,
		OwnerID:            hs.OwnerID,
		OwnerName:          hs.OwnerName,
		OwnerSurname:       hs.OwnerSurname,
		OwnerPhone:         hs.OwnerPhone,
		OwnerAvatarURL:     hs.OwnerAvatarURL,
		OwnerRating:        hs.OwnerRating,
		OwnerReviewsCount:  hs.OwnerReviewsCount,
		OwnerListingsCount: hs.OwnerListingsCount,
		OwnerIsVerified:    hs.OwnerIsVerified,
		Street:          hs.Street,
		HouseNumber:     hs.HouseNumber,
		NumberRoom:      hs.NumberRoom,
		Photos:          photos,
		Services:        toRefDTOs(hs.Services),
		Categories:      toRefDTOs(hs.Categories),
		CheckInAfter:    hs.CheckInAfter,
		CheckOutBefore:  hs.CheckOutBefore,
		SmokingAllowed:  hs.SmokingAllowed,
		PetsAllowed:     hs.PetsAllowed,
		ChildrenAllowed: hs.ChildrenAllowed,
		EventsAllowed:   hs.EventsAllowed,
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
		{"guests", &f.Guests},
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

	checkIn, ok := parseOptDate(q.Get("check_in"))
	if !ok {
		return domain.ListFilter{}, "invalid check_in"
	}
	checkOut, ok := parseOptDate(q.Get("check_out"))
	if !ok {
		return domain.ListFilter{}, "invalid check_out"
	}
	// Availability filtering only applies when both ends are present and the
	// range is non-empty; otherwise leave it unconstrained.
	if checkIn != nil && checkOut != nil {
		if !checkOut.After(*checkIn) {
			return domain.ListFilter{}, "check_out must be after check_in"
		}
		f.CheckIn = checkIn
		f.CheckOut = checkOut
	}

	sort, ok := allowedSorts[q.Get("sort")]
	if !ok {
		return domain.ListFilter{}, "invalid sort"
	}
	f.Sort = sort

	return f, ""
}

// parseOptDate parses an optional YYYY-MM-DD date. Empty → (nil, true); a valid
// date → (&t, true); anything else → (nil, false).
func parseOptDate(s string) (*time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, true
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil, false
	}
	return &t, true
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
