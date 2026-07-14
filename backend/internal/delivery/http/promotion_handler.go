package http

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	promotionuc "github.com/TrollLOLik/sutki/backend/internal/usecase/promotion"
	"github.com/go-chi/chi/v5"
)

type PromotionHandler struct{ svc *promotionuc.Service }

func NewPromotionHandler(svc *promotionuc.Service) *PromotionHandler {
	return &PromotionHandler{svc: svc}
}

func (h *PromotionHandler) Checkout(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	houseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid listing id")
		return
	}
	var body struct {
		ProductCode string `json:"product_code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	result, err := h.svc.Checkout(r.Context(), userID, int32(houseID), body.ProductCode, strings.TrimSpace(r.Header.Get("Idempotency-Key")))
	if err != nil {
		log.Printf("promotion checkout failed: user=%d house=%d product=%q: %v", userID, houseID, body.ProductCode, err)
		writePaymentError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}
func (h *PromotionHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	houseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid listing id")
		return
	}
	items, err := h.svc.List(r.Context(), userID, int32(houseID))
	if err != nil {
		writePaymentError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
