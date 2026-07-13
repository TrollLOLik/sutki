package http

import (
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/listing"
)

var viewEventIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

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
	OwnerID     int32    `json:"owner_id"`
	Address     string   `json:"address"`
	City        string   `json:"city"`
	Description string   `json:"description"`
	Price       int32    `json:"price"`
	Rooms       string   `json:"rooms"`
	Area        int32    `json:"area"`
	Lat         *float64 `json:"lat"`
	Lng         *float64 `json:"lng"`
	Radius      float64  `json:"radius"`
	QcGeo       *int32   `json:"qc_geo"`
	MaxGuests   *int32   `json:"max_guests"`
	Views       int32    `json:"views"`
	Views30d    *int32   `json:"views_30d,omitempty"`
	CoverURL    string   `json:"cover_url"`
	// Rating is the average review score (0 when there are no reviews);
	// ReviewsCount is the published review count.
	Rating             float64    `json:"rating"`
	ReviewsCount       int32      `json:"reviews_count"`
	PromotionTypes     []string   `json:"promotion_types"`
	PromotionExpiresAt *time.Time `json:"promotion_expires_at,omitempty"`
	// Status and RejectionReason are owner-only moderation fields, populated
	// exclusively by listMine (public list endpoints never set them).
	Status          string  `json:"status,omitempty"`
	RejectionReason *string `json:"rejection_reason,omitempty"`
}

type listingDetailDTO struct {
	listingCardDTO
	OwnerID            int32      `json:"owner_id"`
	OwnerName          string     `json:"owner_name"`
	OwnerSurname       string     `json:"owner_surname"`
	OwnerPatronymic    string     `json:"owner_patronymic"`
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
	ReviewsSummary     *string    `json:"reviews_summary"`
	LocationSummary    *string    `json:"location_summary"`
	POIs               []poiDTO   `json:"pois"`
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

func (h *ListingHandler) mapClusters(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.MapClusters(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type poiDTO struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Distance int32  `json:"distance"`
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
	QcGeo           *int32   `json:"qc_geo"`
	MaxGuests       *int32   `json:"max_guests"`
	ServiceIDs      []int32  `json:"service_ids"`
	CategoryIDs     []int32  `json:"category_ids"`
	CheckInAfter    *string  `json:"check_in_after"`
	CheckOutBefore  *string  `json:"check_out_before"`
	SmokingAllowed  *string  `json:"smoking_allowed"`
	PetsAllowed     *string  `json:"pets_allowed"`
	ChildrenAllowed *string  `json:"children_allowed"`
	EventsAllowed   *string  `json:"events_allowed"`
	Photos          []string `json:"photos"`
	POIs            []poiDTO `json:"pois"`
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
	pois := make([]domain.HousePOI, 0, len(body.POIs))
	for _, p := range body.POIs {
		pois = append(pois, domain.HousePOI{
			Name:     p.Name,
			Type:     p.Type,
			Distance: p.Distance,
		})
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
		QcGeo:           body.QcGeo,
		MaxGuests:       body.MaxGuests,
		ServiceIDs:      body.ServiceIDs,
		CategoryIDs:     body.CategoryIDs,
		CheckInAfter:    body.CheckInAfter,
		CheckOutBefore:  body.CheckOutBefore,
		SmokingAllowed:  body.SmokingAllowed,
		PetsAllowed:     body.PetsAllowed,
		ChildrenAllowed: body.ChildrenAllowed,
		EventsAllowed:   body.EventsAllowed,
		Photos:          body.Photos,
		POIs:            pois,
	}
	hs, err := h.svc.Create(r.Context(), in)
	if err != nil {
		switch {
		case errors.Is(err, listing.ErrInvalidListing):
			writeError(w, http.StatusBadRequest, "invalid listing")
		case errors.Is(err, listing.ErrTooManySubmissions):
			writeError(w, http.StatusTooManyRequests, "daily listing submission limit reached")
		default:
			writeError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}
	writeJSON(w, http.StatusCreated, h.detailDTO(hs, true)) // owner always sees exact coords
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
	pois := make([]domain.HousePOI, 0, len(body.POIs))
	for _, p := range body.POIs {
		pois = append(pois, domain.HousePOI{
			Name:     p.Name,
			Type:     p.Type,
			Distance: p.Distance,
		})
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
		QcGeo:           body.QcGeo,
		MaxGuests:       body.MaxGuests,
		ServiceIDs:      body.ServiceIDs,
		CategoryIDs:     body.CategoryIDs,
		CheckInAfter:    body.CheckInAfter,
		CheckOutBefore:  body.CheckOutBefore,
		SmokingAllowed:  body.SmokingAllowed,
		PetsAllowed:     body.PetsAllowed,
		ChildrenAllowed: body.ChildrenAllowed,
		EventsAllowed:   body.EventsAllowed,
		Photos:          body.Photos,
		POIs:            pois,
	}
	hs, err := h.svc.Update(r.Context(), int32(id), in)
	if err != nil {
		switch {
		case errors.Is(err, listing.ErrInvalidListing):
			writeError(w, http.StatusBadRequest, "invalid listing")
		case errors.Is(err, listing.ErrTooManySubmissions):
			writeError(w, http.StatusTooManyRequests, "daily listing submission limit reached")
		case errors.Is(err, domain.ErrNotFound):
			writeError(w, http.StatusNotFound, "listing not found")
		default:
			writeError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}
	writeJSON(w, http.StatusOK, h.detailDTO(hs, true)) // owner always sees exact coords
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
		card := h.cardDTO(hs)
		card.Views30d = hs.Views30d
		// Owner-only: expose moderation state so the app can render badges
		// ("На проверке", "Отклонено: причина") in "My listings".
		card.Status = hs.Status
		if hs.Status == domain.HouseStatusRejected {
			card.RejectionReason = hs.RejectionReason
		}
		items = append(items, card)
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

	// Non-active listings (pending moderation / review / rejected) are only
	// visible to their owner. GetHouseByID has no status filter, so enforce
	// it here; 404 (not 403) to avoid leaking the listing's existence.
	callerID, isAuthed := userIDFromContext(r.Context())
	if hs.Status != domain.HouseStatusActive && (!isAuthed || callerID != hs.OwnerID) {
		writeError(w, http.StatusNotFound, "listing not found")
		return
	}

	// Determine whether the requesting user can see exact coordinates.
	// Owner always can; confirmed/active guests also can. Everyone else gets
	// fuzzed coordinates.  Failures here are non-fatal: fall back to fuzzed.
	exactCoords := false
	if callerID, ok := userIDFromContext(r.Context()); ok {
		if callerID == hs.OwnerID {
			exactCoords = true
		} else {
			hasBooking, berr := h.svc.UserHasConfirmedBooking(r.Context(), callerID, int32(id))
			if berr == nil && hasBooking {
				exactCoords = true
			}
		}
	}

	dto := h.detailDTO(hs, exactCoords)
	if isAuthed && callerID == hs.OwnerID {
		dto.Status = hs.Status
		dto.RejectionReason = hs.RejectionReason
		dto.Views30d = hs.Views30d
	}
	writeJSON(w, http.StatusOK, dto)
}

type recordListingViewRequest struct {
	EventID string `json:"event_id"`
}

func (h *ListingHandler) recordView(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body recordListingViewRequest
	if !decodeJSON(w, r, &body) {
		return
	}
	body.EventID = strings.TrimSpace(body.EventID)
	if !viewEventIDPattern.MatchString(body.EventID) {
		writeError(w, http.StatusBadRequest, "invalid event_id")
		return
	}

	guestID := strings.TrimSpace(r.Header.Get("X-Guest-Id"))
	userID, authenticated := userIDFromContext(r.Context())
	identityKey := guestID
	var userIDPtr *int32
	if authenticated {
		identityKey = "user:" + strconv.FormatInt(int64(userID), 10)
		userIDPtr = &userID
	}
	if identityKey == "" || len(identityKey) > 128 {
		writeError(w, http.StatusBadRequest, "viewer identity is required")
		return
	}
	if !ViewIdentityLimiter.Allow("listing_view:"+identityKey, 300) || !ViewIPLimiter.Allow("listing_view_ip:"+getClientIP(r), 1000) {
		writeError(w, http.StatusTooManyRequests, "too many view events")
		return
	}

	result, err := h.svc.RecordView(r.Context(), body.EventID, int32(id), guestID, userIDPtr)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotFound):
			writeError(w, http.StatusNotFound, "listing not found")
		case errors.Is(err, listing.ErrMissingViewIdentity):
			writeError(w, http.StatusBadRequest, "viewer identity is required")
		default:
			writeError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"counted": result.Counted, "views": result.Views})
}

func (h *ListingHandler) cardDTO(hs domain.House) listingCardDTO {
	// Lists and map tab always get fuzzed coordinates — no per-row DB check.
	lat, lng, radius := fuzzedCoords(hs)
	return listingCardDTO{
		ID:                 hs.ID,
		OwnerID:            hs.OwnerID,
		Address:            address(hs),
		City:               hs.City,
		Description:        hs.Description,
		Price:              hs.Price,
		Rooms:              hs.CountRoom,
		Area:               hs.Area,
		Lat:                lat,
		Lng:                lng,
		Radius:             radius,
		QcGeo:              hs.QcGeo,
		MaxGuests:          hs.MaxGuests,
		Views:              hs.Views,
		CoverURL:           resolveMediaURL(hs.CoverPath),
		Rating:             hs.Rating,
		ReviewsCount:       hs.ReviewsCount,
		PromotionTypes:     hs.PromotionTypes,
		PromotionExpiresAt: hs.PromotionExpiresAt,
	}
}

// fuzzedCoords returns coordinates safe for public display.
// When the house has no lat/lng the returned pointers are nil and radius is 0.
func fuzzedCoords(hs domain.House) (lat, lng *float64, radius float64) {
	if hs.Lat == nil || hs.Lng == nil {
		return nil, nil, 0
	}
	fl, flng := domain.FuzzCoordinates(*hs.Lat, *hs.Lng, hs.ID)
	return &fl, &flng, domain.FuzzRadius
}

func (h *ListingHandler) detailDTO(hs domain.House, exactCoords bool) listingDetailDTO {
	photos := make([]photoDTO, 0, len(hs.Photos))
	for _, p := range hs.Photos {
		photos = append(photos, photoDTO{ID: p.ID, URL: resolveMediaURL(p.Path), Position: p.Position})
	}

	// Build the card with correct coordinate privacy.
	card := h.cardDTO(hs) // starts with fuzzed coords
	if exactCoords && hs.Lat != nil && hs.Lng != nil {
		card.Lat = hs.Lat
		card.Lng = hs.Lng
		card.Radius = 0
	}

	if card.CoverURL == "" && len(photos) > 0 {
		card.CoverURL = photos[0].URL
	}
	return listingDetailDTO{
		listingCardDTO:     card,
		OwnerID:            hs.OwnerID,
		OwnerName:          hs.OwnerName,
		OwnerSurname:       hs.OwnerSurname,
		OwnerPatronymic:    hs.OwnerPatronymic,
		OwnerPhone:         hs.OwnerPhone,
		OwnerAvatarURL:     resolveMediaURL(hs.OwnerAvatarURL),
		OwnerRating:        hs.OwnerRating,
		OwnerReviewsCount:  hs.OwnerReviewsCount,
		OwnerListingsCount: hs.OwnerListingsCount,
		OwnerIsVerified:    hs.OwnerIsVerified,
		Street:             hs.Street,
		HouseNumber:        hs.HouseNumber,
		NumberRoom:         hs.NumberRoom,
		Photos:             photos,
		Services:           toRefDTOs(hs.Services),
		Categories:         toRefDTOs(hs.Categories),
		CheckInAfter:       hs.CheckInAfter,
		CheckOutBefore:     hs.CheckOutBefore,
		SmokingAllowed:     hs.SmokingAllowed,
		PetsAllowed:        hs.PetsAllowed,
		ChildrenAllowed:    hs.ChildrenAllowed,
		EventsAllowed:      hs.EventsAllowed,
		ReviewsSummary:     hs.ReviewsSummary,
		LocationSummary:    hs.LocationSummary,
		POIs:               toPOIDTOs(hs.POIs),
	}
}

func toPOIDTOs(pois []domain.HousePOI) []poiDTO {
	out := make([]poiDTO, 0, len(pois))
	for _, poi := range pois {
		out = append(out, poiDTO{Name: poi.Name, Type: poi.Type, Distance: poi.Distance})
	}
	return out
}

func toRefDTOs(refs []domain.Ref) []refDTO {
	out := make([]refDTO, 0, len(refs))
	for _, ref := range refs {
		out = append(out, refDTO{ID: ref.ID, Name: ref.Name})
	}
	return out
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
	"oldest":     domain.SortOldest,
	"popular":    domain.SortPopular,
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

	houseIDs, ok := parseNonNegInt32CSV(q.Get("house_ids"))
	if !ok {
		return domain.ListFilter{}, "invalid house_ids"
	}
	f.HouseIDs = houseIDs

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

	for _, p := range []struct {
		key string
		dst **bool
	}{
		{"pets_allowed", &f.PetsAllowed},
		{"children_allowed", &f.ChildrenAllowed},
		{"events_allowed", &f.EventsAllowed},
	} {
		b, ok := parseOptBool(q.Get(p.key))
		if !ok {
			return domain.ListFilter{}, "invalid " + p.key
		}
		if b != nil && !*b {
			b = nil
		}
		*p.dst = b
	}

	// Bounding box for map-tab viewport queries: bbox=minLng,minLat,maxLng,maxLat
	if bbox := strings.TrimSpace(q.Get("bbox")); bbox != "" {
		parts := strings.SplitN(bbox, ",", 4)
		if len(parts) != 4 {
			return domain.ListFilter{}, "invalid bbox: expected minLng,minLat,maxLng,maxLat"
		}
		minLng, ok1 := parseFloat64(parts[0])
		minLat, ok2 := parseFloat64(parts[1])
		maxLng, ok3 := parseFloat64(parts[2])
		maxLat, ok4 := parseFloat64(parts[3])
		if !ok1 || !ok2 || !ok3 || !ok4 {
			return domain.ListFilter{}, "invalid bbox: values must be valid floats"
		}
		if minLat > maxLat || minLng > maxLng {
			return domain.ListFilter{}, "invalid bbox: min must be <= max"
		}
		f.MinLat = &minLat
		f.MaxLat = &maxLat
		f.MinLng = &minLng
		f.MaxLng = &maxLng
	}

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

// parseOptBool parses an optional boolean. Empty → (nil, true);
// a valid value → (&v, true); anything else → (nil, false).
func parseOptBool(s string) (*bool, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, true
	}
	b, err := strconv.ParseBool(s)
	if err != nil {
		return nil, false
	}
	return &b, true
}

// parseFloat64 parses a float64 from a trimmed string.
func parseFloat64(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}
