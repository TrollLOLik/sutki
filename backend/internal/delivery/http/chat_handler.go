package http

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

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
	r.Get("/conversations/{id}/presence", h.conversationPresence)
	r.Post("/conversations/{id}/typing", h.typing)
	r.Post("/presence/heartbeat", h.presenceHeartbeat)
	r.Post("/attachments/presign", h.presignUpload)
}

func (h *ChatHandler) HostResponseStats(w http.ResponseWriter, r *http.Request) {
	hostID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || hostID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	stats, err := h.svc.HostResponseStats(r.Context(), int32(hostID))
	if err != nil {
		writeInternalError(w, r, err, "failed to get host response stats")
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (h *ChatHandler) wsTokens(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := h.svc.TouchPresence(r.Context(), userID); err != nil {
		log.Printf("chat presence heartbeat during token issue (user=%d): %v", userID, err)
	}

	token, err := h.svc.ConnectionToken(userID)
	if err != nil {
		writeInternalError(w, r, err, "failed to generate token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"connection_token": token,
	})
}

func (h *ChatHandler) presenceHeartbeat(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.svc.TouchPresence(r.Context(), userID); err != nil {
		writeInternalError(w, r, err, "failed to update presence")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ChatHandler) conversationPresence(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || convID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	presence, err := h.svc.ConversationPresence(r.Context(), userID, convID)
	if err != nil {
		if errors.Is(err, domain.ErrBookingForbidden) {
			writeError(w, http.StatusForbidden, "not a participant of this conversation")
			return
		}
		writeInternalError(w, r, err, "failed to get conversation presence")
		return
	}
	writeJSON(w, http.StatusOK, presence)
}

type typingRequest struct {
	Active bool `json:"active"`
}

func (h *ChatHandler) typing(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	convID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || convID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}
	if !ChatTypingLimiter.Allow(fmt.Sprintf("chat_typing_user_%d", userID), 90) {
		writeError(w, http.StatusTooManyRequests, "too many typing updates")
		return
	}

	var req typingRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := h.svc.PublishTyping(r.Context(), userID, convID, req.Active); err != nil {
		if errors.Is(err, domain.ErrBookingForbidden) {
			writeError(w, http.StatusForbidden, "not a participant of this conversation")
			return
		}
		writeInternalError(w, r, err, "failed to publish typing state")
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
		writeInternalError(w, r, err, "failed to generate subscription token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"subscription_token": token,
	})
}

type conversationSummaryDTO struct {
	ConversationID         int64      `json:"conversation_id"`
	HouseID                *int32     `json:"house_id,omitempty"`
	LastActivity           time.Time  `json:"last_activity"`
	UnreadCount            int64      `json:"unread_count"`
	LastMessageID          *int64     `json:"last_message_id,omitempty"`
	LastMessageBody        string     `json:"last_message_body"`
	LastMessageSenderID    *int32     `json:"last_message_sender_id,omitempty"`
	LastMessageCreatedAt   *time.Time `json:"last_message_created_at,omitempty"`
	OtherLastReadMessageID *int64     `json:"other_last_read_message_id,omitempty"`
	OtherUserID            int32      `json:"other_user_id"`
	OtherUserName          string     `json:"other_user_name"`
	OtherUserSurname       string     `json:"other_user_surname"`
	OtherUserAvatarUrl     string     `json:"other_user_avatar_url"`
	OtherUserPhone         string     `json:"other_user_phone"`
	OtherUserDeleted       bool       `json:"other_user_deleted"`
	HouseStreet            *string    `json:"house_street,omitempty"`
	HouseNumber            *string    `json:"house_number,omitempty"`
	HouseCountRoom         *string    `json:"house_count_room,omitempty"`
	HousePrice             *int32     `json:"house_price,omitempty"`
	HouseCoverPath         string     `json:"house_cover_path"`
}

func (h *ChatHandler) listConversations(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	convs, err := h.svc.ListUserConversations(r.Context(), userID)
	if err != nil {
		writeInternalError(w, r, err, "failed to list conversations")
		return
	}

	dtos := make([]conversationSummaryDTO, 0, len(convs))
	for _, c := range convs {
		dtos = append(dtos, conversationSummaryDTO{
			ConversationID:         c.ConversationID,
			HouseID:                c.HouseID,
			LastActivity:           c.LastActivity,
			UnreadCount:            c.UnreadCount,
			LastMessageID:          c.LastMessageID,
			LastMessageBody:        c.LastMessageBody,
			LastMessageSenderID:    c.LastMessageSenderID,
			LastMessageCreatedAt:   c.LastMessageCreatedAt,
			OtherLastReadMessageID: c.OtherLastReadMessageID,
			OtherUserID:            c.OtherUserID,
			OtherUserName:          c.OtherUserName,
			OtherUserSurname:       c.OtherUserSurname,
			OtherUserAvatarUrl:     resolveMediaURL(c.OtherUserAvatarUrl),
			OtherUserPhone:         c.OtherUserPhone,
			OtherUserDeleted:       c.OtherUserDeleted,
			HouseStreet:            c.HouseStreet,
			HouseNumber:            c.HouseNumber,
			HouseCountRoom:         c.HouseCountRoom,
			HousePrice:             c.HousePrice,
			HouseCoverPath:         resolveMediaURL(c.HouseCoverPath),
		})
	}

	writeJSON(w, http.StatusOK, dtos)
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

	// Rate-limit conversation creation per user to slow down spam campaigns.
	if !ChatConversationLimiter.Allow(fmt.Sprintf("chat_conv_user_%d", userID), 30) {
		writeError(w, http.StatusTooManyRequests, "too many conversation requests, try again later")
		return
	}

	convID, err := h.svc.FindOrCreateConversation(r.Context(), req.HouseID, userID, req.UserID)
	if err != nil {
		// Log the full error server-side, but only return curated messages to
		// the client so internal storage/database details never leak.
		log.Printf("[Chat] FindOrCreateConversation error (user1=%d, user2=%d, house=%v): %v", userID, req.UserID, req.HouseID, err)
		switch {
		case errors.Is(err, chat.ErrSelfConversation):
			writeError(w, http.StatusBadRequest, "cannot create conversation with yourself")
		case errors.Is(err, chat.ErrContactNotAllowed):
			writeError(w, http.StatusForbidden, "you can only message users you have a listing or booking relationship with")
		default:
			writeInternalError(w, r, err, "internal error")
		}
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
		writeInternalError(w, r, err, "failed to get messages")
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
		switch {
		case errors.Is(err, domain.ErrBookingForbidden):
			writeError(w, http.StatusForbidden, "У вас нет доступа к этому диалогу.")
		case errors.Is(err, chat.ErrRecipientDeleted):
			writeError(w, http.StatusBadRequest, "Нельзя написать этому пользователю: его профиль удалён.")
		case errors.Is(err, chat.ErrEmptyMessage):
			writeError(w, http.StatusBadRequest, "Сообщение не может быть пустым.")
		case errors.Is(err, chat.ErrInvalidAttachment):
			writeError(w, http.StatusBadRequest, "Некорректное вложение. Выберите файл ещё раз.")
		case errors.Is(err, chat.ErrAttachmentTooLarge):
			writeError(w, http.StatusBadRequest, "Размер вложения превышает 15 МБ.")
		case errors.Is(err, domain.ErrUnsafeImage):
			writeError(w, http.StatusUnprocessableEntity, "Изображение не прошло модерацию. Выберите другое фото.")
		case errors.Is(err, domain.ErrImageModerationUnavailable):
			writeError(w, http.StatusServiceUnavailable, "Проверка изображения временно недоступна. Попробуйте ещё раз.")
		default:
			log.Printf("[Chat] SendMessage error (user=%d, conv=%d): %v", userID, convID, err)
			writeInternalError(w, r, err, "internal error")
		}
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
		writeInternalError(w, r, err, "failed to mark as read")
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
		switch {
		case errors.Is(err, chat.ErrFileTooLarge):
			writeError(w, http.StatusBadRequest, "Размер файла превышает 15 МБ.")
		case errors.Is(err, chat.ErrFileTypeNotAllowed):
			writeError(w, http.StatusBadRequest, "Этот тип файла не поддерживается. Выберите PDF, TXT, DOC, DOCX, XLS или XLSX.")
		default:
			log.Printf("[Chat] PresignUpload error (user=%d): %v", userID, err)
			writeInternalError(w, r, err, "internal error")
		}
		return
	}

	writeJSON(w, http.StatusOK, target)
}
