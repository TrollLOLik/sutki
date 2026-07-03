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
)

// attachmentKeyPattern is the only S3 object-key shape accepted for chat
// attachments. Keys are minted server-side by PresignUpload as
// "chat/uploads/<32 hex chars><ext>", so any other value on an incoming
// message is rejected to prevent referencing arbitrary/other users' objects.
var attachmentKeyPattern = regexp.MustCompile(`^chat/uploads/[0-9a-f]{32}(\.[A-Za-z0-9]+)?$`)

// errInvalidAttachmentKey is returned when a client supplies an attachment key
// that was not minted by this service.
var errInvalidAttachmentKey = errors.New("invalid attachment reference")

// Config holds settings for the chat service and Centrifugo
type Config struct {
	CentrifugoURL string
	CentrifugoKey string // API Key for server API calls
	HMACSecret    string // Shared secret to sign JWTs
}

type Service struct {
	repo          domain.ChatRepository
	storage       domain.FileStorage
	centrifugoURL string
	centrifugoKey string
	hmacSecret    string
}

func New(repo domain.ChatRepository, storage domain.FileStorage, cfg Config) *Service {
	return &Service{
		repo:          repo,
		storage:       storage,
		centrifugoURL: cfg.CentrifugoURL,
		centrifugoKey: cfg.CentrifugoKey,
		hmacSecret:    cfg.HMACSecret,
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

func (s *Service) FindOrCreateConversation(ctx context.Context, houseID *int32, user1, user2 int32) (int64, error) {
	if user1 == user2 {
		return 0, errors.New("cannot create conversation with yourself")
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
		return domain.Message{}, errors.New("нельзя написать этому пользователю, так как его профиль удален")
	}

	// Validate body and attachments (at least one must be present)
	hasBody := body != nil && strings.TrimSpace(*body) != ""
	if !hasBody && len(attachments) == 0 {
		return domain.Message{}, errors.New("message cannot be empty")
	}

	// Verify S3 attachments (stat check)
	for i, att := range attachments {
		// att.URL holds the S3 object key on incoming request. Reject anything
		// that does not match a key this service minted via PresignUpload,
		// otherwise a client could reference (and have us presign) another
		// user's private object.
		if !attachmentKeyPattern.MatchString(att.URL) {
			return domain.Message{}, errInvalidAttachmentKey
		}
		info, err := s.storage.StatObject(ctx, att.URL)
		if err != nil {
			return domain.Message{}, fmt.Errorf("failed to verify attachment on S3: %w", err)
		}
		// Max size validation (15 MB)
		if info.SizeBytes > 15*1024*1024 {
			return domain.Message{}, fmt.Errorf("file %s exceeds 15MB limit", att.FileName)
		}
		// Save the clean S3 object key (e.g. chat/uploads/...) to the database, rather than the public URL
		attachments[i].URL = att.URL
		attachments[i].SizeBytes = info.SizeBytes
		attachments[i].MimeType = info.ContentType
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

	return msg, nil
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

	return nil
}

func (s *Service) PresignUpload(ctx context.Context, userID int32, fileName string, size int64, contentType string) (domain.UploadTarget, error) {
	// 1. Size check (15MB)
	if size > 15*1024*1024 {
		return domain.UploadTarget{}, errors.New("file size exceeds 15MB limit")
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
		return domain.UploadTarget{}, fmt.Errorf("file type %s is not allowed", contentType)
	}

	// 3. Generate secure random key path
	uuid, err := generateRandomHex(16)
	if err != nil {
		return domain.UploadTarget{}, err
	}
	ext := filepath.Ext(fileName)
	key := fmt.Sprintf("chat/uploads/%s%s", uuid, ext)

	// 4. Generate presigned upload params
	return s.storage.PresignUpload(ctx, key, size, contentType)
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
	recipientID, err := s.repo.GetOtherParticipantID(ctx, msg.ConversationID, msg.SenderID)
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
