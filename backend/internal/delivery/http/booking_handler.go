package http

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/booking"
)

const dateLayout = "2006-01-02"

// BookingHandler serves the authenticated bookings (rental requests) API.
type BookingHandler struct {
	svc          *booking.Service
	mediaBaseURL string
}

func NewBookingHandler(svc *booking.Service, mediaBaseURL string) *BookingHandler {
	return &BookingHandler{svc: svc, mediaBaseURL: mediaBaseURL}
}

// Routes registers the /requests endpoints (mounted behind AuthMiddleware).
// Creating a booking lives under the listing it targets (see Create), wired
// separately in the router.
func (h *BookingHandler) Routes(r chi.Router) {
	r.Get("/", h.listMine)
	r.Get("/incoming", h.listIncoming)
	r.Get("/{id}", h.get)
	r.Post("/{id}/confirm", h.confirm)
	r.Post("/{id}/reject", h.reject)
	r.Post("/{id}/cancel", h.cancel)
}

type bookingHouseDTO struct {
	ID       int32  `json:"id"`
	Address  string `json:"address"`
	City     string `json:"city"`
	Price    int32  `json:"price"`
	CoverURL string `json:"cover_url"`
}

type bookingDTO struct {
	ID              int32            `json:"id"`
	HouseID         int32            `json:"house_id"`
	UserID          int32            `json:"user_id"`
	Name            string           `json:"name"`
	Surname         string           `json:"surname"`
	Lastname        string           `json:"lastname"`
	Count           int32            `json:"count"`
	Message         string           `json:"message"`
	Phone           string           `json:"phone"`
	StartDate       string           `json:"start_date"`
	EndDate         *string          `json:"end_date"`
	Status          string           `json:"status"`
	RejectionReason string           `json:"rejection_reason"`
	ConfirmedAt     *string          `json:"confirmed_at"`
	CreatedAt       string           `json:"created_at"`
	UpdatedAt       string           `json:"updated_at"`
	House           *bookingHouseDTO `json:"house,omitempty"`
}

type bookingListResponse struct {
	Items  []bookingDTO `json:"items"`
	Total  int64        `json:"total"`
	Limit  int32        `json:"limit"`
	Offset int32        `json:"offset"`
}

// Create handles POST /api/v1/listings/{id}/requests: the authenticated user
// books the listing identified by the {id} path param.
func (h *BookingHandler) Create(w http.ResponseWriter, r *http.Request) {
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
		Count     int32   `json:"count"`
		Name      string  `json:"name"`
		Surname   string  `json:"surname"`
		Lastname  string  `json:"lastname"`
		Phone     string  `json:"phone"`
		Message   string  `json:"message"`
		StartDate string  `json:"start_date"`
		EndDate   *string `json:"end_date"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	nb := domain.NewBooking{
		HouseID:  int32(houseID),
		UserID:   userID,
		Name:     strings.TrimSpace(body.Name),
		Surname:  strings.TrimSpace(body.Surname),
		Lastname: strings.TrimSpace(body.Lastname),
		Count:    body.Count,
		Message:  strings.TrimSpace(body.Message),
		Phone:    strings.TrimSpace(body.Phone),
	}
	if nb.Count < 1 {
		writeError(w, http.StatusBadRequest, "invalid count")
		return
	}
	if nb.Name == "" {
		writeError(w, http.StatusBadRequest, "invalid name")
		return
	}
	if nb.Phone == "" {
		writeError(w, http.StatusBadRequest, "invalid phone")
		return
	}

	start, ok := parseDate(body.StartDate)
	// Allow dates starting from yesterday (UTC) to handle timezone offsets on client devices.
	// A client in e.g. UTC+5 may send "today" which equals yesterday in UTC.
	if !ok || start.Before(yesterday()) {
		writeError(w, http.StatusBadRequest, "invalid start_date")
		return
	}
	nb.StartDate = start
	if body.EndDate != nil && strings.TrimSpace(*body.EndDate) != "" {
		end, ok := parseDate(*body.EndDate)
		if !ok || end.Before(start) {
			writeError(w, http.StatusBadRequest, "invalid end_date")
			return
		}
		nb.EndDate = &end
	}

	b, err := h.svc.Create(r.Context(), nb)
	if err != nil {
		h.writeBookingError(w, err, "listing not found")
		return
	}
	writeJSON(w, http.StatusCreated, h.bookingDTO(b))
}

func (h *BookingHandler) listMine(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	res, err := h.svc.ListMine(r.Context(), userID, parseInt32(r.URL.Query().Get("limit"), 0), parseInt32(r.URL.Query().Get("offset"), 0), r.URL.Query().Get("scope"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	h.writeList(w, res)
}

func (h *BookingHandler) listIncoming(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	res, err := h.svc.ListIncoming(r.Context(), userID, parseInt32(r.URL.Query().Get("limit"), 0), parseInt32(r.URL.Query().Get("offset"), 0))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	h.writeList(w, res)
}

func (h *BookingHandler) get(w http.ResponseWriter, r *http.Request) {
	userID, id, ok := h.actorAndID(w, r)
	if !ok {
		return
	}
	b, err := h.svc.Get(r.Context(), id, userID)
	if err != nil {
		h.writeBookingError(w, err, "booking not found")
		return
	}
	writeJSON(w, http.StatusOK, h.bookingDTO(b))
}

func (h *BookingHandler) confirm(w http.ResponseWriter, r *http.Request) {
	userID, id, ok := h.actorAndID(w, r)
	if !ok {
		return
	}
	b, err := h.svc.Confirm(r.Context(), id, userID)
	if err != nil {
		h.writeBookingError(w, err, "booking not found")
		return
	}
	writeJSON(w, http.StatusOK, h.bookingDTO(b))
}

func (h *BookingHandler) reject(w http.ResponseWriter, r *http.Request) {
	userID, id, ok := h.actorAndID(w, r)
	if !ok {
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	if r.ContentLength != 0 && !decodeJSON(w, r, &body) {
		return
	}
	b, err := h.svc.Reject(r.Context(), id, userID, strings.TrimSpace(body.Reason))
	if err != nil {
		h.writeBookingError(w, err, "booking not found")
		return
	}
	writeJSON(w, http.StatusOK, h.bookingDTO(b))
}

func (h *BookingHandler) cancel(w http.ResponseWriter, r *http.Request) {
	userID, id, ok := h.actorAndID(w, r)
	if !ok {
		return
	}
	b, err := h.svc.Cancel(r.Context(), id, userID)
	if err != nil {
		h.writeBookingError(w, err, "booking not found")
		return
	}
	writeJSON(w, http.StatusOK, h.bookingDTO(b))
}

func (h *BookingHandler) actorAndID(w http.ResponseWriter, r *http.Request) (int32, int32, bool) {
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

func (h *BookingHandler) writeList(w http.ResponseWriter, res booking.ListResult) {
	items := make([]bookingDTO, 0, len(res.Items))
	for _, b := range res.Items {
		items = append(items, h.bookingDTO(b))
	}
	writeJSON(w, http.StatusOK, bookingListResponse{
		Items:  items,
		Total:  res.Total,
		Limit:  res.Limit,
		Offset: res.Offset,
	})
}

func (h *BookingHandler) bookingDTO(b domain.Booking) bookingDTO {
	dto := bookingDTO{
		ID:              b.ID,
		HouseID:         b.HouseID,
		UserID:          b.UserID,
		Name:            b.Name,
		Surname:         b.Surname,
		Lastname:        b.Lastname,
		Count:           b.Count,
		Message:         b.Message,
		Phone:           b.Phone,
		StartDate:       b.StartDate.Format(dateLayout),
		Status:          b.Status,
		RejectionReason: b.RejectionReason,
		CreatedAt:       b.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:       b.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if b.EndDate != nil {
		s := b.EndDate.Format(dateLayout)
		dto.EndDate = &s
	}
	if b.ConfirmedAt != nil {
		s := b.ConfirmedAt.UTC().Format(time.RFC3339)
		dto.ConfirmedAt = &s
	}
	if b.House != nil {
		dto.House = &bookingHouseDTO{
			ID:       b.House.ID,
			Address:  strings.TrimSpace(strings.TrimSpace(b.House.Street) + " " + strings.TrimSpace(b.House.HouseNumber)),
			City:     b.House.City,
			Price:    b.House.Price,
			CoverURL: h.mediaURL(b.House.CoverPath),
		}
	}
	return dto
}

// mediaURL mirrors ListingHandler.mediaURL for booking house covers.
func (h *BookingHandler) mediaURL(p string) string {
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

func (h *BookingHandler) writeBookingError(w http.ResponseWriter, err error, notFoundMsg string) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, notFoundMsg)
	case errors.Is(err, domain.ErrListingUnavailable):
		writeError(w, http.StatusConflict, "listing unavailable")
	case errors.Is(err, domain.ErrDatesUnavailable):
		writeError(w, http.StatusConflict, "dates unavailable")
	case errors.Is(err, domain.ErrBookingForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, domain.ErrBookingNotPending):
		writeError(w, http.StatusConflict, "booking not pending")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

func parseDate(s string) (time.Time, bool) {
	t, err := time.Parse(dateLayout, strings.TrimSpace(s))
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

func today() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

// yesterday returns the start of yesterday in UTC.
// Used for timezone-safe validation: clients ahead of UTC (e.g. UTC+5)
// may send a date that equals "yesterday" in UTC terms.
func yesterday() time.Time {
	return today().AddDate(0, 0, -1)
}
