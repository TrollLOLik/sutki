package http

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/chat"
)

type ChatHandler struct {
	svc *chat.Service
}

func NewChatHandler(svc *chat.Service) *ChatHandler {
	return &ChatHandler{svc: svc}
}

func (h *ChatHandler) Routes(r chi.Router) {
	r.Get("/ws-tokens", h.wsTokens)
	r.Post("/subscription-token", h.subscriptionToken)
	r.Get("/conversations", h.listConversations)
	r.Post("/conversations", h.findOrCreateConversation)
	r.Get("/conversations/{id}/messages", h.getMessages)
	r.Post("/conversations/{id}/messages", h.sendMessage)
	r.Post("/conversations/{id}/read", h.readMessages)
	r.Post("/attachments/presign", h.presignUpload)
}

func (h *ChatHandler) wsTokens(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	token, err := h.svc.ConnectionToken(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"connection_token": token,
	})
}

type subscriptionTokenRequest struct {
	ConversationID int64 `json:"conversation_id"`
}

func (h *ChatHandler) subscriptionToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req subscriptionTokenRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.ConversationID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid conversation_id")
		return
	}

	token, err := h.svc.SubscriptionToken(r.Context(), userID, req.ConversationID)
	if err != nil {
		if errors.Is(err, domain.ErrBookingForbidden) {
			writeError(w, http.StatusForbidden, "not a participant of this conversation")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to generate subscription token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"subscription_token": token,
	})
}

func (h *ChatHandler) listConversations(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convs, err := h.svc.ListUserConversations(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list conversations")
		return
	}

	writeJSON(w, http.StatusOK, convs)
}

type findOrCreateConversationRequest struct {
	HouseID *int32 `json:"house_id"`
	UserID  int32  `json:"user_id"`
}

func (h *ChatHandler) findOrCreateConversation(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req findOrCreateConversationRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.UserID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid user_id")
		return
	}

	convID, err := h.svc.FindOrCreateConversation(r.Context(), req.HouseID, userID, req.UserID)
	if err != nil {
		log.Printf("[Chat] FindOrCreateConversation error (user1=%d, user2=%d, house=%v): %v", userID, req.UserID, req.HouseID, err)
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]int64{
		"conversation_id": convID,
	})
}

func (h *ChatHandler) getMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	cursorStr := r.URL.Query().Get("cursor")
	var cursor int64
	if cursorStr != "" {
		c, err := strconv.ParseInt(cursorStr, 10, 64)
		if err == nil {
			cursor = c
		}
	}

	limitStr := r.URL.Query().Get("limit")
	var limit int32 = 20
	if limitStr != "" {
		l, err := strconv.ParseInt(limitStr, 10, 32)
		if err == nil {
			limit = int32(l)
		}
	}

	msgs, err := h.svc.GetConversationMessages(r.Context(), userID, convID, cursor, limit)
	if err != nil {
		if errors.Is(err, domain.ErrBookingForbidden) {
			writeError(w, http.StatusForbidden, "not a participant of this conversation")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get messages")
		return
	}

	writeJSON(w, http.StatusOK, msgs)
}

type sendMessageRequest struct {
	Body        *string                    `json:"body"`
	Attachments []domain.MessageAttachment `json:"attachments"`
}

func (h *ChatHandler) sendMessage(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	var req sendMessageRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	msg, err := h.svc.SendMessage(r.Context(), userID, convID, req.Body, req.Attachments)
	if err != nil {
		if errors.Is(err, domain.ErrBookingForbidden) {
			writeError(w, http.StatusForbidden, "not a participant of this conversation")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, msg)
}

type readMessagesRequest struct {
	MessageID int64 `json:"message_id"`
}

func (h *ChatHandler) readMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	var req readMessagesRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.MessageID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid message_id")
		return
	}

	err = h.svc.ReadMessages(r.Context(), userID, convID, req.MessageID)
	if err != nil {
		if errors.Is(err, domain.ErrBookingForbidden) {
			writeError(w, http.StatusForbidden, "not a participant of this conversation")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to mark as read")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type presignUploadRequest struct {
	FileName    string `json:"file_name"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
}

func (h *ChatHandler) presignUpload(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req presignUploadRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.FileName == "" || req.Size <= 0 || req.ContentType == "" {
		writeError(w, http.StatusBadRequest, "missing required fields (file_name, size, content_type)")
		return
	}

	target, err := h.svc.PresignUpload(r.Context(), userID, req.FileName, req.Size, req.ContentType)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, target)
}
