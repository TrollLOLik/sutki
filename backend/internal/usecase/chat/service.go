package chat

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/imagemoderation"
)

// attachmentKeyPattern is the only S3 object-key shape accepted for chat
// attachments. Keys are minted server-side by PresignUpload as
// "chat/uploads/<32 hex chars><ext>", so any other value on an incoming
// message is rejected to prevent referencing arbitrary/other users' objects.
var attachmentKeyPattern = regexp.MustCompile(`^chat/uploads/[0-9a-f]{32}(\.[A-Za-z0-9]+)?$`)

// Sentinel errors exposed so the HTTP layer can map user-facing failures to
// safe, curated messages instead of leaking internal error text (wrapped
// storage/database details) to clients.
var (
	// ErrInvalidAttachment is returned when a client supplies an attachment
	// key that was not minted by this service.
	ErrInvalidAttachment = errors.New("invalid attachment reference")
	// ErrSelfConversation is returned when a user tries to open a chat with
	// themselves.
	ErrSelfConversation = errors.New("cannot create conversation with yourself")
	// ErrContactNotAllowed is returned when a user tries to start a chat with
	// someone they have no listing/booking relationship with (anti-spam).
	ErrContactNotAllowed = errors.New("contact not allowed")
	// ErrRecipientDeleted is returned when the other participant's profile is
	// deleted.
	ErrRecipientDeleted = errors.New("recipient profile deleted")
	// ErrEmptyMessage is returned when a message has neither body nor
	// attachments.
	ErrEmptyMessage = errors.New("message cannot be empty")
	// ErrAttachmentTooLarge is returned when the uploaded object exceeds
	// maxAttachmentBytes.
	ErrAttachmentTooLarge = errors.New("attachment exceeds size limit")
	// ErrFileTooLarge is returned by PresignUpload for oversized declared sizes.
	ErrFileTooLarge = errors.New("file size exceeds limit")
	// ErrFileTypeNotAllowed is returned by PresignUpload for non-whitelisted
	// content types.
	ErrFileTypeNotAllowed = errors.New("file type not allowed")
)

// maxAttachmentBytes is the maximum accepted size for a chat attachment,
// enforced server-side against the actual uploaded object.
const maxAttachmentBytes = 15 * 1024 * 1024

// Config holds settings for the chat service and Centrifugo
type Config struct {
	CentrifugoURL string
	CentrifugoKey string // API Key for server API calls
	HMACSecret    string // Shared secret to sign JWTs
	// Notifier queues "new message" emails for offline recipients. May be
	// nil; email notifications are then disabled.
	Notifier domain.EmailNotifier
	// UserEvents persists notification-center events and publishes realtime
	// invalidations. It is independent from email delivery.
	UserEvents     domain.UserEventPublisher
	ImageModerator domain.ImageModerator
}

type Service struct {
	repo           domain.ChatRepository
	storage        domain.FileStorage
	centrifugoURL  string
	centrifugoKey  string
	hmacSecret     string
	notifier       domain.EmailNotifier
	userEvents     domain.UserEventPublisher
	imageModerator domain.ImageModerator
}

func New(repo domain.ChatRepository, storage domain.FileStorage, cfg Config) *Service {
	return &Service{
		repo:           repo,
		storage:        storage,
		centrifugoURL:  cfg.CentrifugoURL,
		centrifugoKey:  cfg.CentrifugoKey,
		hmacSecret:     cfg.HMACSecret,
		notifier:       cfg.Notifier,
		userEvents:     cfg.UserEvents,
		imageModerator: cfg.ImageModerator,
	}
}

// ConnectionToken signs a connection-JWT for Centrifugo socket connection
func (s *Service) ConnectionToken(userID int32) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": fmt.Sprintf("%d", userID),
		"exp": time.Now().Add(30 * time.Minute).Unix(),
	})
	return token.SignedString([]byte(s.hmacSecret))
}

// SubscriptionToken signs a subscription-JWT for a private channel
func (s *Service) SubscriptionToken(ctx context.Context, userID int32, convID int64) (string, error) {
	// Verify that user is a participant of the conversation
	isParticipant, err := s.repo.CheckParticipantExists(ctx, convID, userID)
	if err != nil {
		return "", err
	}
	if !isParticipant {
		return "", domain.ErrBookingForbidden // map to forbidden
	}

	channel := fmt.Sprintf("chat:conv_%d", convID)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":     fmt.Sprintf("%d", userID),
		"channel": channel,
		"exp":     time.Now().Add(30 * time.Minute).Unix(),
	})
	return token.SignedString([]byte(s.hmacSecret))
}

func (s *Service) ListUserConversations(ctx context.Context, userID int32) ([]domain.ConversationSummary, error) {
	convs, err := s.repo.ListUserConversations(ctx, userID)
	if err != nil {
		return nil, err
	}
	for i := range convs {
		if convs[i].HouseCoverPath != "" {
			convs[i].HouseCoverPath = s.storage.PublicURL(convs[i].HouseCoverPath)
		}
	}
	return convs, nil
}

func (s *Service) HostResponseStats(ctx context.Context, hostID int32) (domain.HostResponseStats, error) {
	if hostID <= 0 {
		return domain.HostResponseStats{}, nil
	}
	return s.repo.GetHostResponseStats(ctx, hostID)
}

func (s *Service) FindOrCreateConversation(ctx context.Context, houseID *int32, user1, user2 int32) (int64, error) {
	if user1 == user2 {
		return 0, ErrSelfConversation
	}
	// Anti-spam: a user may only open a conversation when there is a real
	// relationship with the target — an existing conversation between them, a
	// listing contact (target owns the referenced house), or a booking
	// relationship in either direction. Otherwise any authenticated user could
	// message arbitrary user IDs.
	allowed, err := s.repo.CanContact(ctx, houseID, user1, user2)
	if err != nil {
		return 0, err
	}
	if !allowed {
		return 0, ErrContactNotAllowed
	}
	return s.repo.FindOrCreateConversation(ctx, houseID, user1, user2)
}

func (s *Service) presignAttachment(ctx context.Context, att domain.MessageAttachment) domain.MessageAttachment {
	if att.URL == "" {
		return att
	}
	// If the URL already looks like a fully qualified HTTP URL, return as is
	if strings.HasPrefix(att.URL, "http://") || strings.HasPrefix(att.URL, "https://") {
		return att
	}

	// Clean any bucket prefix dynamically (e.g. "chat-uploads/chat/uploads/..." -> "chat/uploads/...")
	key := att.URL
	if idx := strings.Index(key, "chat/uploads/"); idx != -1 {
		key = key[idx:]
	}

	// Only presign keys that match the server-minted attachment shape. This
	// guards against presigning arbitrary objects if a bad key ever reached
	// storage.
	if !attachmentKeyPattern.MatchString(key) {
		log.Printf("[Chat] Refusing to presign unexpected attachment key: %q", key)
		return att
	}

	// Presign GET request for 24 hours
	presignedURL, err := s.storage.PresignGet(ctx, key, 24*time.Hour)
	if err != nil {
		log.Printf("[Chat] Failed to generate presigned GET URL for key %s: %v", key, err)
		return att
	}
	att.URL = presignedURL
	return att
}

func (s *Service) GetConversationMessages(ctx context.Context, userID int32, convID int64, cursorMessageID int64, limit int32) ([]domain.Message, error) {
	// Verify participation
	isParticipant, err := s.repo.CheckParticipantExists(ctx, convID, userID)
	if err != nil {
		return nil, err
	}
	if !isParticipant {
		return nil, domain.ErrBookingForbidden
	}

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	msgs, err := s.repo.GetConversationMessages(ctx, convID, cursorMessageID, limit)
	if err != nil {
		return nil, err
	}

	// Presign attachment URLs for delivery to client
	for i := range msgs {
		for j := range msgs[i].Attachments {
			msgs[i].Attachments[j] = s.presignAttachment(ctx, msgs[i].Attachments[j])
		}
	}

	return msgs, nil
}

func (s *Service) SendMessage(ctx context.Context, userID int32, convID int64, body *string, attachments []domain.MessageAttachment) (domain.Message, error) {
	// Verify participation
	isParticipant, err := s.repo.CheckParticipantExists(ctx, convID, userID)
	if err != nil {
		return domain.Message{}, err
	}
	if !isParticipant {
		return domain.Message{}, domain.ErrBookingForbidden
	}

	// Verify if other user is deleted
	isOtherDeleted, err := s.repo.IsOtherParticipantDeleted(ctx, convID, userID)
	if err != nil {
		return domain.Message{}, err
	}
	if isOtherDeleted {
		return domain.Message{}, ErrRecipientDeleted
	}

	// Validate body and attachments (at least one must be present)
	hasBody := body != nil && strings.TrimSpace(*body) != ""
	if !hasBody && len(attachments) == 0 {
		return domain.Message{}, ErrEmptyMessage
	}

	// Verify S3 attachments (stat check)
	imageKeys := make([]string, 0, len(attachments))
	for i, att := range attachments {
		// att.URL holds the S3 object key on incoming request. Reject anything
		// that does not match a key this service minted via PresignUpload,
		// otherwise a client could reference (and have us presign) another
		// user's private object.
		if !attachmentKeyPattern.MatchString(att.URL) {
			return domain.Message{}, ErrInvalidAttachment
		}
		info, err := s.storage.StatObject(ctx, att.URL)
		if err != nil {
			return domain.Message{}, fmt.Errorf("failed to verify attachment on S3: %w", err)
		}
		// Enforce the size limit against the actual uploaded object, not a
		// client-claimed size. Presigned PUT cannot cap upload size, so a
		// client could push an oversized object; reject it and delete the
		// orphaned object best-effort. Deletion is safe here because the key
		// already matched attachmentKeyPattern and StatObject confirmed it
		// exists (we never delete arbitrary client-supplied keys).
		if info.SizeBytes > maxAttachmentBytes {
			if delErr := s.storage.Delete(ctx, att.URL); delErr != nil {
				log.Printf("[Chat] Failed to delete oversized attachment %q: %v", att.URL, delErr)
			}
			return domain.Message{}, ErrAttachmentTooLarge
		}
		// Save the clean S3 object key (e.g. chat/uploads/...) to the database, rather than the public URL
		attachments[i].URL = att.URL
		attachments[i].SizeBytes = info.SizeBytes
		attachments[i].MimeType = info.ContentType
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(info.ContentType)), "image/") {
			imageKeys = append(imageKeys, att.URL)
		}
	}
	if len(imageKeys) > 0 && s.imageModerator != nil {
		result, err := imagemoderation.ModerateStoredImages(ctx, s.imageModerator, s.storage, imageKeys, "chat", maxAttachmentBytes)
		if err != nil {
			log.Printf("[Chat] Image moderation failed (user=%d, conv=%d): %v", userID, convID, err)
			return domain.Message{}, err
		}
		if result.Decision != domain.ImageModerationApprove {
			log.Printf("[Chat] Image moderation rejected upload (user=%d, conv=%d, category=%s)", userID, convID, result.Category)
			for _, key := range imageKeys {
				if delErr := s.storage.Delete(ctx, key); delErr != nil {
					log.Printf("[Chat] Failed to delete rejected image %q: %v", key, delErr)
				}
			}
			return domain.Message{}, fmt.Errorf("%w: %s", domain.ErrUnsafeImage, result.Reason)
		}
	}

	msg, err := s.repo.CreateMessage(ctx, convID, userID, body, attachments)
	if err != nil {
		return domain.Message{}, err
	}

	// Presign attachment URLs for delivery to client (including Centrifugo publish)
	for i := range msg.Attachments {
		msg.Attachments[i] = s.presignAttachment(ctx, msg.Attachments[i])
	}

	// Publish to Centrifugo in background (use detached context since HTTP ctx is cancelled after response)
	go s.publishMessage(context.Background(), msg)

	// Queue an email for the recipient if they are not connected right now.
	// Runs in background: presence check + enqueue must not delay the HTTP
	// response. The notifier dedups per conversation within a quiet window,
	// so message bursts produce at most one email.
	if s.notifier != nil || s.userEvents != nil {
		go s.notifyRecipient(context.Background(), msg)
	}

	return msg, nil
}

// PostBookingStatus implements domain.ChatSystemPoster. It finds or creates
// the owner-guest conversation for the listing and inserts a booking status
// card as a system message (sender_id NULL). The card is published to the
// conversation channel plus both participants' personal channels. Dedup is
// enforced by the DB unique index: reposting the same (request, event) is a
// silent no-op. Never called from HTTP handlers — only backend use cases.
func (s *Service) PostBookingStatus(ctx context.Context, houseID, ownerID, guestID int32, payload domain.BookingStatusPayload) error {
	if guestID == 0 || ownerID == 0 || guestID == ownerID {
		return nil // guest bookings without an account have no conversation
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal booking status payload: %w", err)
	}

	// Bypass CanContact: a booking relationship exists by construction here.
	convID, err := s.repo.FindOrCreateConversation(ctx, &houseID, guestID, ownerID)
	if err != nil {
		return fmt.Errorf("find/create conversation for booking card: %w", err)
	}

	msg, created, err := s.repo.CreateSystemMessage(ctx, convID, domain.MessageKindBookingStatus, payloadJSON, bookingCardFallback(payload))
	if err != nil {
		return fmt.Errorf("create booking status message: %w", err)
	}
	if !created {
		return nil // duplicate card, already posted
	}

	// Publish to the conversation channel and both personal channels so the
	// dialog and both users' conversation lists update in real time.
	go func() {
		channel := fmt.Sprintf("chat:conv_%d", msg.ConversationID)
		_ = s.centrifugoPublish(channel, map[string]any{
			"type":    "message.new",
			"message": msg,
		})
		for _, uid := range []int32{ownerID, guestID} {
			_ = s.centrifugoPublish(fmt.Sprintf("user:#%d", uid), map[string]any{
				"type":            "unread_update",
				"conversation_id": msg.ConversationID,
			})
		}
	}()

	return nil
}

// bookingCardFallback builds the human-readable body stored alongside a
// booking card. Old app versions (unaware of kind/payload) render this text
// as a plain message, so it must be self-explanatory.
func bookingCardFallback(p domain.BookingStatusPayload) string {
	switch p.Event {
	case domain.BookingEventNew:
		if p.StartDate != "" && p.EndDate != "" {
			return fmt.Sprintf("Новая заявка на бронирование: %s — %s", p.StartDate, p.EndDate)
		}
		return "Новая заявка на бронирование"
	case domain.BookingEventConfirmed:
		return "Заявка на бронирование подтверждена"
	case domain.BookingEventRejected:
		if p.Reason != "" {
			return "Заявка отклонена: " + p.Reason
		}
		return "Заявка на бронирование отклонена"
	case domain.BookingEventCancelled:
		return "Заявка на бронирование отменена гостем"
	default:
		return "Обновление статуса бронирования"
	}
}

// notifyRecipient persists the in-app event for every recipient and emails
// them when they have no active Centrifugo connection. It never fails the
// send path; all errors are logged and dropped.
func (s *Service) notifyRecipient(ctx context.Context, msg domain.Message) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("chat notification panic recovered: %v", r)
		}
	}()

	if msg.SenderID == nil {
		return // system messages never trigger chat emails
	}
	recipientID, recipientEmail, senderName, err := s.repo.GetChatEmailInfo(ctx, msg.ConversationID, *msg.SenderID)
	if err != nil {
		log.Printf("chat email notify: lookup for conv %d: %v", msg.ConversationID, err)
		return
	}
	if s.userEvents != nil {
		preview := "Вам отправили вложение"
		if msg.Body != nil && strings.TrimSpace(*msg.Body) != "" {
			preview = strings.TrimSpace(*msg.Body)
			if len([]rune(preview)) > 120 {
				preview = string([]rune(preview)[:120]) + "…"
			}
		}
		if err := s.userEvents.PublishUserEvent(ctx, recipientID, domain.UserEvent{
			EventKey: fmt.Sprintf("message:%d", msg.ID), Type: "message.changed",
			Scope: domain.ActivityScopeMessages, Action: "created", EntityID: msg.ConversationID,
			Payload:    map[string]any{"message_id": msg.ID, "sender_name": senderName, "preview": preview},
			OccurredAt: msg.CreatedAt, MarkUnread: true,
		}); err != nil {
			log.Printf("chat notification: persist message %d: %v", msg.ID, err)
		}
	}

	if s.notifier == nil || recipientEmail == "" {
		return
	}

	// Skip when the recipient is online: they will see the message in-app.
	// If the presence check itself fails we fall through and send the email —
	// better a redundant notification than a missed message.
	if online, err := s.isUserOnline(recipientID); err != nil {
		log.Printf("chat email notify: presence check for user %d failed, emailing anyway: %v", recipientID, err)
	} else if online {
		return
	}

	if err := s.notifier.NotifyChatMessage(ctx, recipientID, recipientEmail, senderName, msg.ConversationID); err != nil {
		log.Printf("chat email notify: queue email for conv %d: %v", msg.ConversationID, err)
	}
}

// isUserOnline asks Centrifugo whether the user has any active connection on
// their personal channel (the app subscribes to it on every launch).
func (s *Service) isUserOnline(userID int32) (bool, error) {
	if s.centrifugoURL == "" {
		return false, nil
	}

	url := fmt.Sprintf("%s/api", strings.TrimRight(s.centrifugoURL, "/"))
	body := map[string]any{
		"method": "presence_stats",
		"params": map[string]any{
			"channel": fmt.Sprintf("user:#%d", userID),
		},
	}
	jsonBytes, err := json.Marshal(body)
	if err != nil {
		return false, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.centrifugoKey != "" {
		req.Header.Set("X-API-Key", s.centrifugoKey)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("centrifugo status %d", resp.StatusCode)
	}

	var parsed struct {
		Result struct {
			NumClients int `json:"num_clients"`
		} `json:"result"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return false, err
	}
	if parsed.Error != nil {
		// Presence not enabled for the namespace, channel unknown, etc.
		return false, fmt.Errorf("centrifugo error %d: %s", parsed.Error.Code, parsed.Error.Message)
	}
	return parsed.Result.NumClients > 0, nil
}

func (s *Service) ReadMessages(ctx context.Context, userID int32, convID int64, messageID int64) error {
	// Verify participation
	isParticipant, err := s.repo.CheckParticipantExists(ctx, convID, userID)
	if err != nil {
		return err
	}
	if !isParticipant {
		return domain.ErrBookingForbidden
	}

	err = s.repo.UpdateLastReadMessage(ctx, messageID, convID, userID)
	if err != nil {
		return err
	}

	// Notify read event in background
	go s.publishReadEvent(convID, userID, messageID)
	go func() {
		_ = s.centrifugoPublish(fmt.Sprintf("user:#%d", userID), map[string]any{
			"type": "unread_update", "conversation_id": convID,
		})
	}()
	if reader, ok := s.userEvents.(domain.UserNotificationReader); ok {
		go func() {
			markCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := reader.MarkEntityNotificationsRead(markCtx, userID, domain.ActivityScopeMessages, convID); err != nil {
				log.Printf("chat notification: mark conversation %d read: %v", convID, err)
			}
		}()
	}

	return nil
}

func (s *Service) PresignUpload(ctx context.Context, userID int32, fileName string, size int64, contentType string) (domain.UploadTarget, error) {
	// 1. Size check (15MB)
	if size > maxAttachmentBytes {
		return domain.UploadTarget{}, ErrFileTooLarge
	}

	// 2. MIME whitelist check
	allowed := false
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	allowedTypes := []string{
		"image/jpeg", "image/png", "image/webp", "image/gif",
		"application/pdf", "text/plain",
		"application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	}
	for _, t := range allowedTypes {
		if contentType == t {
			allowed = true
			break
		}
	}
	if !allowed {
		return domain.UploadTarget{}, ErrFileTypeNotAllowed
	}

	// 3. Generate secure random key path
	uuid, err := generateRandomHex(16)
	if err != nil {
		return domain.UploadTarget{}, err
	}
	ext := filepath.Ext(fileName)
	key := fmt.Sprintf("chat/uploads/%s%s", uuid, ext)

	// 4. Generate presigned POST params. Pass the server-side limit (not the
	// client-claimed size) as the content-length-range upper bound: picker
	// sizes are unreliable, and S3 enforces this bound authoritatively.
	return s.storage.PresignUpload(ctx, key, maxAttachmentBytes, contentType)
}

func (s *Service) publishMessage(ctx context.Context, msg domain.Message) {
	// 1. Publish to conversation channel (for users with chat open)
	channel := fmt.Sprintf("chat:conv_%d", msg.ConversationID)
	payload := map[string]any{
		"type":    "message.new",
		"message": msg,
	}
	_ = s.centrifugoPublish(channel, payload)

	// 2. Notify the recipient's personal channel (for conversation list updates)
	if msg.SenderID == nil {
		return // system messages publish personal-channel updates themselves
	}
	recipientID, err := s.repo.GetOtherParticipantID(ctx, msg.ConversationID, *msg.SenderID)
	if err != nil {
		log.Printf("chat: failed to get recipient for personal notification: %v", err)
		return
	}
	personalChannel := fmt.Sprintf("user:#%d", recipientID)
	personalPayload := map[string]any{
		"type":            "unread_update",
		"conversation_id": msg.ConversationID,
	}
	_ = s.centrifugoPublish(personalChannel, personalPayload)
	// The sender may have the app open on another device. Keep that device's
	// conversation preview in sync even though its unread count stays zero.
	_ = s.centrifugoPublish(fmt.Sprintf("user:#%d", *msg.SenderID), personalPayload)
}

func (s *Service) publishReadEvent(convID int64, userID int32, messageID int64) {
	channel := fmt.Sprintf("chat:conv_%d", convID)
	payload := map[string]any{
		"type":       "message.read",
		"user_id":    userID,
		"message_id": messageID,
	}
	_ = s.centrifugoPublish(channel, payload)
}

func (s *Service) centrifugoPublish(channel string, payload any) error {
	if s.centrifugoURL == "" {
		return nil
	}

	url := fmt.Sprintf("%s/api", strings.TrimRight(s.centrifugoURL, "/"))
	body := map[string]any{
		"method": "publish",
		"params": map[string]any{
			"channel": channel,
			"data":    payload,
		},
	}

	jsonBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.centrifugoKey != "" {
		req.Header.Set("X-API-Key", s.centrifugoKey) // Centrifugo v6 default API header or custom key
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("chat: failed to publish to Centrifugo: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("chat: Centrifugo API returned status %d", resp.StatusCode)
		return fmt.Errorf("centrifugo status %d", resp.StatusCode)
	}

	return nil
}

func generateRandomHex(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
