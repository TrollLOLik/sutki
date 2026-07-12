package http

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	paymentuc "github.com/TrollLOLik/sutki/backend/internal/usecase/payment"
)

type PaymentHandler struct{ svc *paymentuc.Service }

func NewPaymentHandler(svc *paymentuc.Service) *PaymentHandler { return &PaymentHandler{svc: svc} }

func (h *PaymentHandler) Products(w http.ResponseWriter, r *http.Request) {
	products, err := h.svc.Products(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	type dto struct {
		Code            string `json:"code"`
		Title           string `json:"title"`
		Purpose         string `json:"purpose"`
		AmountKopecks   int32  `json:"amount_kopecks"`
		Currency        string `json:"currency"`
		ServiceType     string `json:"service_type,omitempty"`
		DurationSeconds int32  `json:"duration_seconds,omitempty"`
	}
	out := make([]dto, 0, len(products))
	for _, p := range products {
		out = append(out, dto{p.Code, p.Title, p.Purpose, p.AmountKopecks, p.Currency, p.ServiceType, p.DurationSeconds})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

func (h *PaymentHandler) Checkout(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		ProductCode string `json:"product_code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := h.svc.Checkout(r.Context(), userID, body.ProductCode, strings.TrimSpace(r.Header.Get("Idempotency-Key")))
	if err != nil {
		writePaymentError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (h *PaymentHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payment id")
		return
	}
	p, err := h.svc.Get(r.Context(), id, userID)
	if err != nil {
		writePaymentError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": p.ID, "purpose": p.Purpose, "product_code": p.ProductCode, "status": p.Status, "amount_kopecks": p.AmountKopecks, "currency": p.Currency, "confirmation_url": p.ConfirmationURL, "created_at": p.CreatedAt, "paid_at": p.PaidAt})
}

func (h *PaymentHandler) Webhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if _, err = h.svc.AcceptWebhook(r.Context(), body); err != nil {
		writePaymentError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}

func (h *PaymentHandler) Refund(w http.ResponseWriter, r *http.Request) {
	if !h.svc.AdminAuthorized(r.Header.Get("X-Payment-Admin-Token")) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payment id")
		return
	}
	var body struct {
		AmountKopecks int32  `json:"amount_kopecks"`
		Reason        string `json:"reason"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	refund, err := h.svc.Refund(r.Context(), id, body.AmountKopecks, body.Reason, strings.TrimSpace(r.Header.Get("Idempotency-Key")), 0)
	if err != nil {
		writePaymentError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, refund)
}

func (h *PaymentHandler) MockSetStatus(w http.ResponseWriter, r *http.Request) {
	if !h.svc.AdminAuthorized(r.Header.Get("X-Payment-Admin-Token")) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if err := h.svc.MockSetStatus(r.Context(), chi.URLParam(r, "provider_id"), body.Status); err != nil {
		writePaymentError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "webhook_queued"})
}

func (h *PaymentHandler) MockConfirm(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payment id")
		return
	}
	if err := h.svc.MockConfirm(r.Context(), id, userID); err != nil {
		writePaymentError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "webhook_queued"})
}

func writePaymentError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrPaymentNotFound), errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, "payment not found")
	case errors.Is(err, domain.ErrPaymentConflict):
		writeError(w, http.StatusConflict, "payment conflict")
	case errors.Is(err, domain.ErrPaymentNotRefundable):
		writeError(w, http.StatusConflict, "payment is not refundable")
	case errors.Is(err, domain.ErrInvalidWebhook):
		writeError(w, http.StatusBadRequest, "invalid webhook")
	case strings.Contains(err.Error(), "idempotency"), strings.Contains(err.Error(), "receipt contact"):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "payment operation failed")
	}
}
