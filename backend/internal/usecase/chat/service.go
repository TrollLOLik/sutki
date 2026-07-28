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
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/media"
)

// attachmentKeyKind is the media.OwnerPrefix namespace for chat attachments.
// Keys are minted server-side as "chat/uploads/<userID>/<32 hex chars><ext>".
const attachmentKeyKind = "chat/uploads"

// No upload form is ever issued for this namespace. Objects enter it only via
// the backend's conditional server-side copy.
const sealedAttachmentKeyKind = "chat/approved"

// attachmentKeyPattern matches any well-formed chat attachment key, of either
// generation. It answers "is this one of our keys", NOT "may this caller use
// it" — ownership is a separate question, see ownsAttachmentKey.
//
// Shape alone was once the entire check on an incoming message, and that was
// the bug: matching the pattern and existing in the bucket says nothing about
// who uploaded the object. Any participant could lift a key out of a presigned
// URL they legitimately received, attach it to a message in a different
// conversation, and have the server serve someone else's private photo to a
// third party — then delete their own message and destroy the original.
var uploadAttachmentKeyPattern = regexp.MustCompile(`^chat/uploads/(?:[0-9]+/)?[0-9a-f]{32}(\.[A-Za-z0-9]{1,10})?$`)

// Delivery accepts both old upload keys already stored in conversations and
// new immutable server-side snapshots. New messages still accept only upload
// capabilities through ownsAttachmentKey plus the database ownership record.
var deliveryAttachmentKeyPattern = regexp.MustCompile(
	`^(?:chat/uploads/(?:[0-9]+/)?[0-9a-f]{32}|chat/approved/[0-9]+/sealed-[0-9a-f]{64}-[0-9a-f]{64})(\.[A-Za-z0-9]{1,10})?$`,
)

// legacyAttachmentKeyPattern matches keys minted before the owner segment
// existed. They stay readable — old conversations must keep rendering — but
// they can never be attached to a NEW message, because nothing records who
// uploaded them.
var legacyAttachmentKeyPattern = regexp.MustCompile(`^chat/uploads/[0-9a-f]{32}(\.[A-Za-z0-9]+)?$`)

// attachmentKey mints the object key for one user's upload. The caller must
// pass a positive id: OwnerPrefix formats with %d, so a non-positive one would
// produce "chat/uploads/-1/…", which ownsAttachmentKey rejects — the uploader
// could neither attach nor even read their own file.
func attachmentKey(userID int32, random, ext string) string {
	return media.OwnerPrefix(attachmentKeyKind, userID) + random + ext
}

// ownsAttachmentKey reports whether key was minted for userID. A legacy key
// carries no owner and therefore belongs to nobody: it never satisfies this.
func ownsAttachmentKey(key string, userID int32) bool {
	return uploadAttachmentKeyPattern.MatchString(key) && media.IsOwnedKey(key, attachmentKeyKind, userID)
}

func ownsStoredAttachmentKey(key string, userID int32) bool {
	return ownsAttachmentKey(key, userID) ||
		media.IsSealedOwnedKey(key, sealedAttachmentKeyKind, userID)
}

// isLegacyAttachmentKey reports whether key predates the owner segment. Worth
// distinguishing from "someone else's key" in logs: one is a leftover, the
// other would be an attempt to reach across conversations.
func isLegacyAttachmentKey(key string) bool {
	return legacyAttachmentKeyPattern.MatchString(strings.TrimSpace(key))
}

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
	// ErrFileContentNotAllowed is returned when the immutable object's bytes
	// do not match the type registered when the upload capability was issued.
	ErrFileContentNotAllowed = errors.New("file content does not match its declared type")
	// ErrTooManyAttachments is returned when a single message carries more than
	// maxAttachmentsPerMessage files.
	ErrTooManyAttachments = errors.New("too many attachments in one message")
	// ErrAttachmentRetryNotAllowed covers foreign, missing and non-failed
	// attachments without leaking which ids exist.
	ErrAttachmentRetryNotAllowed = errors.New("attachment cannot be retried")

	// ErrMessageTooLong is returned when a body exceeds the storage limit.
	// Without this the value reaches Postgres, raises 22001 and surfaces as a
	// 500 plus an ops alert instead of a plain 400.
	ErrMessageTooLong = errors.New("message body is too long")
	// ErrReplyTargetNotFound is returned when the quoted message does not exist
	// or belongs to another conversation.
	ErrReplyTargetNotFound = errors.New("reply target not found in this conversation")
	// ErrMessageNotFound is returned when the message to edit or delete does not
	// exist.
	ErrMessageNotFound = errors.New("message not found")
	// ErrMessageNotEditable is returned for system cards and for messages whose
	// body cannot be rewritten (attachment-only messages).
	ErrMessageNotEditable = errors.New("message cannot be edited")
	// ErrEditWindowExpired is returned once MessageEditWindow has passed.
	ErrEditWindowExpired = errors.New("edit window expired")
	// ErrDeleteWindowExpired is returned once MessageDeleteWindow has passed.
	ErrDeleteWindowExpired = errors.New("delete window expired")
	// ErrMessageAlreadyRead is returned when the recipient has already read the
	// message the author wants to edit. Rewriting agreed terms after the other
	// party saw them is not acceptable in a booking conversation.
	ErrMessageAlreadyRead = errors.New("message already read by recipient")
	// ErrMessageAlreadyDeleted is returned when the message is already deleted.
	ErrMessageAlreadyDeleted = errors.New("message already deleted")
	// ErrMotionMediaNotAllowed is returned when a new or unverified account tries
	// to upload video or animation.
	ErrMotionMediaNotAllowed = errors.New("video uploads require a verified account")
)

// maxAttachmentBytes is the maximum accepted size for a chat attachment,
// enforced server-side against the actual uploaded object.
const maxAttachmentBytes = 15 * 1024 * 1024

// maxVideoBytes is the size ceiling for video, separate from the 15 MB used for
// photos and documents: a 30-60 second 720p clip lands well above that, and
// forcing it lower would mean visibly worse compression on the device.
const maxVideoBytes = 50 * 1024 * 1024

// motionMediaMinAccountAge is how old an account must be before it may upload
// video or animation. Short on purpose: the goal is to stop bots that register
// and immediately spam, not to make legitimate new owners wait.
const motionMediaMinAccountAge = 24 * time.Hour

// allowedUploadTypes is the whitelist for chat attachments.
//
// Video is restricted to MP4/QuickTime: both are what phone cameras produce, and
// both are formats ffmpeg reads without extra codecs in the worker image. Adding
// a container we cannot probe would mean accepting files we cannot moderate.
var allowedUploadTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	// GIF stays allowed, but is now sampled frame by frame like video instead of
	// being handed to the model as a single still — that first-frame-only check
	// was how "safe cover, violation at second three" used to pass.
	"image/gif":          true,
	"video/mp4":          true,
	"video/quicktime":    true,
	"application/pdf":    true,
	"text/plain":         true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel": true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
}

// maxAttachmentsPerMessage caps how many files one message may carry.
//
// Without this bound a client could reference an arbitrary number of keys and
// make the server perform that many StatObject calls plus one vision-moderation
// request per image — the moderation loop is sequential by design (providers
// only inspect the first image of a multi-image prompt), so an unbounded batch
// is an easy way to tie up a worker. Matches the picker limit on the client.
const maxAttachmentsPerMessage = 10

// maxMessageBodyRunes mirrors the message.body column width (varchar(4000)).
const maxMessageBodyRunes = 4000

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
	// Reply suggestions are optional: with no generator wired the service
	// serves the canned fallback sets (see suggestions.go).
	suggestionGen   SuggestionGenerator
	suggestionDebug bool
	suggestionCache *suggestionCache
	// attachmentQueue schedules asynchronous media checks. Nil disables the
	// pipeline: attachments are then approved on insert, which is the pre-video
	// behaviour and keeps dev environments usable without a worker.
	attachmentQueue AttachmentModerationQueue
	attachmentWaker AttachmentModerationWaker
}

// AttachmentModerationQueue schedules an attachment for background checking.
type AttachmentModerationQueue interface {
	Enqueue(ctx context.Context, job domain.AttachmentModerationJob) error
}

// AttachmentModerationWaker lets the service nudge the worker so a freshly
// uploaded file is checked in about a second instead of at the next tick.
type AttachmentModerationWaker interface {
	Wake()
}

// SetAttachmentModerationQueue wires the asynchronous media pipeline.
func (s *Service) SetAttachmentModerationQueue(queue AttachmentModerationQueue, waker AttachmentModerationWaker) {
	s.attachmentQueue = queue
	s.attachmentWaker = waker
}

// moderationKind maps a byte-sniffed content type to how it must be inspected,
// or "" when no media check applies (documents).
func moderationKind(contentType string) string {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	switch {
	case strings.HasPrefix(ct, "video/"):
		return domain.AttachmentKindVideo
	case ct == "image/gif":
		// A GIF is usually animated, and a vision model shown one effectively
		// sees only its first frame. Sampling it as video closes the "safe
		// cover, violation at second three" gap.
		return domain.AttachmentKindAnimated
	case strings.HasPrefix(ct, "image/"):
		return domain.AttachmentKindImage
	default:
		return ""
	}
}

func New(repo domain.ChatRepository, storage domain.FileStorage, cfg Config) *Service {
	return &Service{
		repo:            repo,
		storage:         storage,
		centrifugoURL:   cfg.CentrifugoURL,
		centrifugoKey:   cfg.CentrifugoKey,
		hmacSecret:      cfg.HMACSecret,
		notifier:        cfg.Notifier,
		userEvents:      cfg.UserEvents,
		imageModerator:  cfg.ImageModerator,
		suggestionCache: newSuggestionCache(),
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

func (s *Service) TouchPresence(ctx context.Context, userID int32) error {
	return s.repo.TouchUserLastSeen(ctx, userID)
}

func (s *Service) ConversationPresence(ctx context.Context, userID int32, convID int64) (domain.ConversationPresence, error) {
	isParticipant, err := s.repo.CheckParticipantExists(ctx, convID, userID)
	if err != nil {
		return domain.ConversationPresence{}, err
	}
	if !isParticipant {
		return domain.ConversationPresence{}, domain.ErrBookingForbidden
	}

	otherUserID, err := s.repo.GetOtherParticipantID(ctx, convID, userID)
	if err != nil {
		return domain.ConversationPresence{}, err
	}
	lastSeenAt, err := s.repo.GetUserLastSeen(ctx, otherUserID)
	if err != nil {
		return domain.ConversationPresence{}, err
	}

	online, err := s.isUserOnline(otherUserID)
	if err != nil {
		// Last-seen remains useful if the realtime service is temporarily
		// unavailable; presence must not break opening the dialog.
		log.Printf("chat presence: lookup for user %d failed: %v", otherUserID, err)
	}
	return domain.ConversationPresence{Online: online, LastSeenAt: lastSeenAt}, nil
}

func (s *Service) PublishTyping(ctx context.Context, userID int32, convID int64, active bool) error {
	isParticipant, err := s.repo.CheckParticipantExists(ctx, convID, userID)
	if err != nil {
		return err
	}
	if !isParticipant {
		return domain.ErrBookingForbidden
	}

	return s.centrifugoPublish(fmt.Sprintf("chat:conv_%d", convID), map[string]any{
		"type":    "typing.changed",
		"user_id": userID,
		"active":  active,
	})
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
	// Drop the stored cover up front and re-derive it below. Sanitising it only
	// on the success path meant every early exit — an empty URL, an already-
	// absolute one, a key that fails the pattern, or simply a transient
	// PresignGet failure — returned whatever string was in the row, which for
	// anything written before the field was sanitised is attacker-chosen.
	storedThumbnail := att.ThumbnailURL
	att.ThumbnailURL = ""

	if att.URL == "" {
		return att
	}
	// If the URL already looks like a fully qualified HTTP URL, return as is
	if strings.HasPrefix(att.URL, "http://") || strings.HasPrefix(att.URL, "https://") {
		return att
	}

	// Clean any bucket prefix dynamically. Legacy rows use chat/uploads while
	// new rows point at immutable chat/approved snapshots.
	key := att.URL
	for _, prefix := range []string{"chat/uploads/", "chat/approved/"} {
		if idx := strings.Index(key, prefix); idx != -1 {
			key = key[idx:]
			break
		}
	}

	// Only presign keys that match the server-minted attachment shape. This
	// guards against presigning arbitrary objects if a bad key ever reached
	// storage.
	if !deliveryAttachmentKeyPattern.MatchString(key) {
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

	// The video cover is a private-bucket key too (the worker writes
	// "<key>.cover.jpg"), so it needs signing as well — handing the client a
	// bare key means the cover simply never loads. The key signed here is
	// derived from the attachment's own key; the stored value is only an
	// equality gate, never itself used.
	if coverKey := coverKeyFor(key, storedThumbnail); coverKey != "" {
		if signed, err := s.storage.PresignGet(ctx, coverKey, 24*time.Hour); err == nil {
			att.ThumbnailURL = signed
		} else {
			log.Printf("[Chat] Failed to sign cover %q: %v", coverKey, err)
		}
	}
	return att
}

// coverKeyFor accepts a stored thumbnail value only when it is exactly the
// cover this service derives from the attachment's own key. Anything else —
// including a leftover client-supplied string from before that field was
// sanitised — yields "" and is dropped.
func coverKeyFor(key, stored string) string {
	want := key + ".cover.jpg"
	if strings.TrimSpace(stored) == want {
		return want
	}
	return ""
}

// enqueueAttachmentModeration queues a check for every attachment that needs one.
//
// Runs after the message is stored, because a job references the attachment id.
// Failures are logged rather than surfaced: the message is already persisted, and
// the attachment stays pending — visible to its sender as "Проверяется" — so
// nothing unchecked reaches the recipient. The stale-lease sweep will pick it up.
func (s *Service) enqueueAttachmentModeration(ctx context.Context, msg domain.Message, kinds map[string]string) {
	if s.attachmentQueue == nil || len(kinds) == 0 {
		return
	}

	queued := 0
	for _, att := range msg.Attachments {
		kind, ok := kinds[att.URL]
		if !ok {
			continue
		}
		job := domain.AttachmentModerationJob{
			AttachmentID:   att.ID,
			MessageID:      msg.ID,
			ConversationID: msg.ConversationID,
			ObjectKey:      att.URL,
			MimeType:       att.MimeType,
			Kind:           kind,
		}
		if err := s.attachmentQueue.Enqueue(ctx, job); err != nil {
			log.Printf("[Chat] Failed to queue moderation for attachment %d: %v", att.ID, err)
			continue
		}
		queued++
	}

	if queued > 0 && s.attachmentWaker != nil {
		s.attachmentWaker.Wake()
	}
}

// hasPendingAttachments reports whether any attachment is still unverified.
func hasPendingAttachments(msg domain.Message) bool {
	for _, att := range msg.Attachments {
		if att.IsBlockingModeration() {
			return true
		}
	}
	return false
}

// RetryAttachmentModeration returns a failed sender-owned upload to the queue.
// The original immutable object is reused, so retrying does not upload media a
// second time and cannot substitute different bytes under the same attachment.
func (s *Service) RetryAttachmentModeration(ctx context.Context, userID int32, attachmentID int64) error {
	messageID, conversationID, ok, err := s.repo.RetryFailedAttachment(ctx, attachmentID, userID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrAttachmentRetryNotAllowed
	}

	if s.attachmentWaker != nil {
		s.attachmentWaker.Wake()
	}
	_ = s.centrifugoPublish(fmt.Sprintf("user:#%d", userID), map[string]any{
		"type":            "attachment.retrying",
		"conversation_id": conversationID,
		"message_id":      messageID,
		"attachment_id":   attachmentID,
	})
	s.publishAttachmentChanged(conversationID, messageID)
	return nil
}

// visibleAttachments strips attachments the viewer must not see yet.
//
// Pending and failed attachments are shown to their own sender as moderation
// state, but hidden from the recipient: unverified media is never delivered.
// Filtering here means every read path inherits the same rule.
func visibleAttachments(msg domain.Message, viewerID int32) []domain.MessageAttachment {
	if len(msg.Attachments) == 0 {
		return msg.Attachments
	}
	isSender := msg.SenderID != nil && *msg.SenderID == viewerID
	out := make([]domain.MessageAttachment, 0, len(msg.Attachments))
	for _, att := range msg.Attachments {
		// A policy rejection is reported through the sender-only realtime event
		// and modal. It is retained in storage for audit, not rendered as a chat
		// message that looks manually deletable.
		if att.ModerationStatus == domain.AttachmentModerationRejected {
			continue
		}
		if !isSender && att.ModerationStatus != domain.AttachmentModerationApproved {
			continue
		}
		out = append(out, att)
	}
	return out
}

// messageVisibleToViewer hides a media message from its recipient until every
// attachment has a verdict. An all-rejected message is hidden from both sides:
// the sender receives a modal explanation instead, and the caption must not
// turn into an unexpected text-only delivery.
func messageVisibleToViewer(msg domain.Message, viewerID int32) bool {
	if msg.SenderID == nil || len(msg.Attachments) == 0 {
		return true
	}
	if *msg.SenderID == viewerID {
		for _, att := range msg.Attachments {
			if att.ModerationStatus != domain.AttachmentModerationRejected {
				return true
			}
		}
		return false
	}
	if hasPendingAttachments(msg) {
		return false
	}
	for _, att := range msg.Attachments {
		if att.ModerationStatus == domain.AttachmentModerationApproved {
			return true
		}
	}
	return false
}

// messageForRecipient returns the sanitized copy safe to publish on the shared
// conversation channel. Rejected and retryable failed states remain sender-only.
func messageForRecipient(msg domain.Message) (domain.Message, bool) {
	if hasPendingAttachments(msg) {
		return domain.Message{}, false
	}
	if len(msg.Attachments) == 0 {
		return msg, true
	}

	approved := make([]domain.MessageAttachment, 0, len(msg.Attachments))
	for _, att := range msg.Attachments {
		if att.ModerationStatus == domain.AttachmentModerationApproved {
			approved = append(approved, att)
		}
	}
	if len(approved) == 0 {
		return domain.Message{}, false
	}
	msg.Attachments = approved
	return msg, true
}

// presignQuote turns the raw storage key of a quote thumbnail into a signed URL.
// Mutates through the pointer because the quote hangs off the message. Nil
// quotes (non-reply messages) are a no-op.
func (s *Service) presignQuote(ctx context.Context, quote *domain.MessageQuote) {
	if quote == nil || quote.FirstAttachmentURL == "" {
		return
	}
	signed := s.presignAttachment(ctx, domain.MessageAttachment{URL: quote.FirstAttachmentURL})
	quote.FirstAttachmentURL = signed.URL
}

// hydrateAndPresignQuote resolves the quote of a single message and signs its
// thumbnail. Used for freshly created messages, where the reply target has not
// been hydrated yet.
func (s *Service) hydrateAndPresignQuote(ctx context.Context, msg *domain.Message) {
	if msg.ReplyToMessageID == nil {
		return
	}
	batch := []domain.Message{*msg}
	if err := s.repo.HydrateReplyQuotes(ctx, batch); err != nil {
		// A missing quote must not fail the send: the message is already
		// persisted, and the client refetches history on reconnect.
		log.Printf("[Chat] Failed to hydrate reply quote for message %d: %v", msg.ID, err)
		return
	}
	msg.ReplyTo = batch[0].ReplyTo
	s.presignQuote(ctx, msg.ReplyTo)
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

	visible := msgs[:0]
	for _, msg := range msgs {
		if messageVisibleToViewer(msg, userID) {
			visible = append(visible, msg)
		}
	}
	msgs = visible

	// Hydrate reply quotes server-side: history is paginated, so the quoted
	// message is frequently outside the page the client just received.
	if err := s.repo.HydrateReplyQuotes(ctx, msgs); err != nil {
		return nil, err
	}

	// Presign attachment URLs for delivery to client, hiding attachments that are
	// still being checked from anyone but their sender.
	for i := range msgs {
		msgs[i].Attachments = visibleAttachments(msgs[i], userID)
		for j := range msgs[i].Attachments {
			msgs[i].Attachments[j] = s.presignAttachment(ctx, msgs[i].Attachments[j])
		}
		s.presignQuote(ctx, msgs[i].ReplyTo)
	}

	return msgs, nil
}

func (s *Service) GetConversationImages(
	ctx context.Context,
	userID int32,
	convID int64,
) ([]domain.MessageAttachment, error) {
	isParticipant, err := s.repo.CheckParticipantExists(ctx, convID, userID)
	if err != nil {
		return nil, err
	}
	if !isParticipant {
		return nil, domain.ErrBookingForbidden
	}

	const maxConversationImages = 500
	images, err := s.repo.GetConversationImages(ctx, convID, maxConversationImages)
	if err != nil {
		return nil, err
	}
	for i := range images {
		images[i] = s.presignAttachment(ctx, images[i])
	}
	return images, nil
}

func (s *Service) SendMessage(ctx context.Context, userID int32, convID int64, body *string, replyToMessageID *int64, attachments []domain.MessageAttachment) (domain.Message, error) {
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
	if hasBody && utf8.RuneCountInString(*body) > maxMessageBodyRunes {
		return domain.Message{}, ErrMessageTooLong
	}
	if len(attachments) > maxAttachmentsPerMessage {
		return domain.Message{}, ErrTooManyAttachments
	}

	// A reply may only quote a message from the same conversation. Without this
	// check a participant could quote a message from an unrelated dialog and
	// have the server hydrate its text into a conversation they can read.
	if replyToMessageID != nil {
		parentConvID, err := s.repo.GetMessageConversation(ctx, *replyToMessageID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.Message{}, ErrReplyTargetNotFound
			}
			return domain.Message{}, err
		}
		if parentConvID != convID {
			return domain.Message{}, ErrReplyTargetNotFound
		}
	}

	// Verify S3 attachments (stat check). moderationKinds collects which of them
	// need an asynchronous media check, keyed by object key — attachment ids do
	// not exist until the message row is written.
	moderationKinds := make(map[string]string, len(attachments))
	seenKeys := make(map[string]struct{}, len(attachments))
	objectKeys := make([]string, 0, len(attachments))
	for _, att := range attachments {
		// att.URL holds the S3 object key on the incoming request. It must be a
		// key THIS user was issued — not merely a well-formed key that exists.
		// Shape plus existence is what let one participant re-attach another's
		// private photo into a conversation the owner is not part of.
		//
		// Legacy keys carry no owner and so cannot pass: they are readable in
		// the conversations they were already sent to, but may not be attached
		// to anything new.
		if !ownsAttachmentKey(att.URL, userID) {
			return domain.Message{}, ErrInvalidAttachment
		}
		// One object, one row. Repeating a key is never something the app does,
		// and each repeat buys another moderation job for the same bytes —
		// video moderation is frame extraction plus a vision call per frame, so
		// a single upload named ten times is a tenfold multiplier on the most
		// expensive work this server does.
		if _, dup := seenKeys[att.URL]; dup {
			return domain.Message{}, ErrInvalidAttachment
		}
		seenKeys[att.URL] = struct{}{}
		objectKeys = append(objectKeys, att.URL)
	}

	uploadsByKey := make(map[string]domain.ChatUpload, len(objectKeys))
	if len(objectKeys) > 0 {
		owned, err := s.repo.CheckChatUploadOwnership(ctx, userID, objectKeys)
		if err != nil {
			return domain.Message{}, err
		}
		if !owned {
			return domain.Message{}, ErrInvalidAttachment
		}

		uploads, err := s.repo.GetChatUploads(ctx, userID, objectKeys)
		if err != nil {
			return domain.Message{}, err
		}
		for _, upload := range uploads {
			uploadsByKey[upload.ObjectKey] = upload
		}
		if len(uploadsByKey) != len(objectKeys) {
			return domain.Message{}, ErrInvalidAttachment
		}
	}

	sourceKeysToDelete := make([]string, 0, len(attachments))
	for i, att := range attachments {
		upload, ok := uploadsByKey[att.URL]
		if !ok {
			return domain.Message{}, ErrInvalidAttachment
		}

		var (
			sealed            media.SealedObject
			shouldPersistSeal bool
		)
		if upload.SealedKey != "" {
			if upload.ContentETag == "" ||
				!media.IsSealedOwnedKey(upload.SealedKey, sealedAttachmentKeyKind, userID) {
				return domain.Message{}, ErrInvalidAttachment
			}
			info, err := s.storage.StatObject(ctx, upload.SealedKey)
			if err != nil {
				return domain.Message{}, fmt.Errorf("verify sealed chat attachment: %w", err)
			}
			if normalizeETag(info.ETag) == "" ||
				normalizeETag(info.ETag) != normalizeETag(upload.ContentETag) {
				return domain.Message{}, errors.New("sealed chat attachment integrity check failed")
			}
			sealed = media.SealedObject{
				SourceKey: att.URL,
				Key:       upload.SealedKey,
				Info:      info,
			}
		} else {
			var err error
			sealed, err = media.SealOwnedObject(
				ctx,
				s.storage,
				att.URL,
				attachmentKeyKind,
				sealedAttachmentKeyKind,
				userID,
				maxVideoBytes,
				allowedUploadTypes,
			)
			if err != nil {
				if errors.Is(err, media.ErrInvalidMediaSize) {
					_ = s.storage.Delete(ctx, att.URL)
					return domain.Message{}, ErrAttachmentTooLarge
				}
				return domain.Message{}, fmt.Errorf("seal chat attachment: %w", err)
			}
			if sealed.Info.SizeBytes > attachmentSizeLimit(sealed.Info.ContentType) {
				if sealed.Created {
					_ = s.storage.Delete(ctx, sealed.Key)
				}
				_ = s.storage.Delete(ctx, att.URL)
				return domain.Message{}, ErrAttachmentTooLarge
			}
			shouldPersistSeal = true
		}

		info := sealed.Info
		detectedType, err := detectStoredAttachmentType(
			ctx,
			s.storage,
			sealed.Key,
			info,
			upload.MimeType,
		)
		if err != nil {
			if errors.Is(err, ErrFileContentNotAllowed) {
				// A newly created immutable snapshot has no legitimate reader
				// yet, so remove both copies. Existing sealed objects may be
				// referenced by older messages and must not be destroyed here.
				if sealed.Created {
					if delErr := s.storage.Delete(ctx, sealed.Key); delErr != nil {
						log.Printf("[Chat] Failed to delete invalid sealed attachment %q: %v", sealed.Key, delErr)
					}
					if delErr := s.storage.Delete(ctx, att.URL); delErr != nil {
						log.Printf("[Chat] Failed to delete invalid upload %q: %v", att.URL, delErr)
					}
				}
			}
			return domain.Message{}, fmt.Errorf("inspect chat attachment content: %w", err)
		}
		info.ContentType = detectedType

		// Enforce the size limit against the actual uploaded object, not a
		// client-claimed size. Presigned PUT cannot cap upload size, so a
		// client could push an oversized object; reject it and delete the
		// orphaned object best-effort. Deletion is safe here because
		// ownsAttachmentKey established that the key was minted for THIS user —
		// the previous comment claimed as much on the strength of a shape match
		// alone, which was not the same thing.
		//
		// The ceiling has to be the same one PresignUpload signed the POST
		// policy with, or the two disagree and this branch deletes a file the
		// server itself accepted: video is signed up to maxVideoBytes, and a
		// 20 MB clip uploaded through the app's own flow was reaching 100% and
		// then being rejected here and destroyed.
		if info.SizeBytes > attachmentSizeLimit(info.ContentType) {
			if sealed.Created {
				if delErr := s.storage.Delete(ctx, sealed.Key); delErr != nil {
					log.Printf("[Chat] Failed to delete oversized sealed attachment %q: %v", sealed.Key, delErr)
				}
			}
			if delErr := s.storage.Delete(ctx, att.URL); delErr != nil {
				log.Printf("[Chat] Failed to delete oversized upload %q: %v", att.URL, delErr)
			}
			return domain.Message{}, ErrAttachmentTooLarge
		}
		if shouldPersistSeal {
			if err := s.repo.SealChatUpload(
				ctx,
				userID,
				att.URL,
				sealed.Key,
				sealed.Info.ETag,
			); err != nil {
				if sealed.Created {
					_ = s.storage.Delete(ctx, sealed.Key)
				}
				if errors.Is(err, domain.ErrChatUploadNotOwned) {
					return domain.Message{}, ErrInvalidAttachment
				}
				return domain.Message{}, err
			}
			sourceKeysToDelete = append(sourceKeysToDelete, att.URL)
		}
		// Recipients and moderation read only the immutable object. UploadKey
		// remains the ownership/refcount identity in the database.
		attachments[i].URL = sealed.Key
		attachments[i].UploadKey = att.URL
		attachments[i].SizeBytes = info.SizeBytes
		attachments[i].MimeType = info.ContentType
		// Same trust boundary as the key: this arrives from client JSON and is
		// stored verbatim, and the recipient's client renders it as the video
		// cover — a URL the recipient's device actually fetches. The moderation
		// worker is the only legitimate writer, once it has extracted a frame
		// from the object we accepted.
		attachments[i].ThumbnailURL = ""
		// Duration likewise comes from ffprobe, not from the sender.
		attachments[i].DurationSeconds = nil
		// Width/Height are a layout hint the picker supplies, so they stay
		// client-supplied — but they are rendered on the RECIPIENT's device,
		// which derives a view height from height/width. A row claiming
		// 1 × 2147483647 makes that device lay out a view hundreds of
		// thousands of screens tall, and since only the sender can delete the
		// message, and only within an hour, the recipient cannot clear it. Keep
		// plausible values, drop the rest — the client already falls back to a
		// fixed height when they are absent.
		attachments[i].Width = plausibleDimension(att.Width)
		attachments[i].Height = plausibleDimension(att.Height)

		// Media is checked after the message is stored, not inside this request.
		// Video needs frame sampling plus a vision call per frame — tens of
		// seconds — so it cannot be held open here. Documents carry no imagery
		// to moderate and are approved on the spot.
		kind := moderationKind(info.ContentType)
		if kind == "" || s.attachmentQueue == nil {
			attachments[i].ModerationStatus = domain.AttachmentModerationApproved
			continue
		}
		attachments[i].ModerationStatus = domain.AttachmentModerationPending
		moderationKinds[sealed.Key] = kind
	}

	msg, err := s.repo.CreateMessage(ctx, convID, userID, body, replyToMessageID, attachments)
	if err != nil {
		if errors.Is(err, domain.ErrChatUploadNotOwned) {
			return domain.Message{}, ErrInvalidAttachment
		}
		return domain.Message{}, err
	}

	// Replaying a presigned form can recreate these source keys, but no reader
	// trusts them after sealing. Delete the current copies best-effort anyway.
	for _, sourceKey := range sourceKeysToDelete {
		if err := s.storage.Delete(ctx, sourceKey); err != nil {
			log.Printf("[Chat] Failed to delete sealed upload source %q: %v", sourceKey, err)
		}
	}

	// Queue the checks now that attachment rows exist and have ids.
	s.enqueueAttachmentModeration(ctx, msg, moderationKinds)

	// Presign attachment URLs for delivery to client (including Centrifugo publish)
	for i := range msg.Attachments {
		msg.Attachments[i] = s.presignAttachment(ctx, msg.Attachments[i])
	}

	// Hydrate the quote before publishing, so the realtime copy carries the same
	// data as the HTTP response. Otherwise the recipient's bubble would render
	// without a quote and only gain it after a refetch.
	s.hydrateAndPresignQuote(ctx, &msg)

	// Publish to Centrifugo in background (use detached context since HTTP ctx is cancelled after response)
	go s.publishMessage(context.Background(), msg)

	// Queue an email for the recipient if they are not connected right now.
	// Runs in background: presence check + enqueue must not delay the HTTP
	// response. The notifier dedups per conversation within a quiet window,
	// so message bursts produce at most one email.
	if recipientMsg, deliverable := messageForRecipient(msg); deliverable && (s.notifier != nil || s.userEvents != nil) {
		go s.notifyRecipient(context.Background(), recipientMsg)
	}

	return msg, nil
}

func normalizeETag(etag string) string {
	return strings.Trim(strings.TrimSpace(etag), `"`)
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

// EditMessage rewrites the body of the caller's own message.
//
// Allowed only while all of the following hold: the caller is the author, the
// message is a user message (never a booking card), it is not deleted, it
// carries a text body, MessageEditWindow has not elapsed, and the recipient has
// not read it yet. The read check is the important one for a booking
// conversation — quietly turning an agreed "5000 ₽" into "7000 ₽" after the
// other party saw it must not be possible.
//
// Attachments are deliberately immutable: swapping a photo after the fact
// changes what the message means, and the recipient has no way to notice.
func (s *Service) EditMessage(ctx context.Context, userID int32, messageID int64, body string) (domain.Message, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return domain.Message{}, ErrEmptyMessage
	}
	if utf8.RuneCountInString(body) > maxMessageBodyRunes {
		return domain.Message{}, ErrMessageTooLong
	}

	info, err := s.repo.GetMessageForMutation(ctx, messageID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Message{}, ErrMessageNotFound
		}
		return domain.Message{}, err
	}

	// Membership is implied by authorship, which is checked next; a non-author
	// gets the same "forbidden" answer whether or not they are a participant.
	if info.SenderID == nil || *info.SenderID != userID {
		return domain.Message{}, domain.ErrBookingForbidden
	}
	if info.DeletedAt != nil {
		return domain.Message{}, ErrMessageAlreadyDeleted
	}
	if info.Kind != domain.MessageKindUser {
		return domain.Message{}, ErrMessageNotEditable
	}
	// An attachment-only message has no text to rewrite. Letting an edit add a
	// body would turn a photo into a photo-with-caption after delivery.
	if info.Body == nil || strings.TrimSpace(*info.Body) == "" {
		return domain.Message{}, ErrMessageNotEditable
	}
	if info.IsReadByOther() {
		return domain.Message{}, ErrMessageAlreadyRead
	}
	if time.Since(info.CreatedAt) > domain.MessageEditWindow {
		return domain.Message{}, ErrEditWindowExpired
	}

	msg, ok, err := s.repo.EditMessageBody(ctx, messageID, userID, body, domain.MessageEditWindow)
	if err != nil {
		return domain.Message{}, err
	}
	if !ok {
		// The SQL guards repeat the checks above, so losing here means a
		// concurrent request won: the window closed or the row was deleted
		// between our read and the update.
		return domain.Message{}, ErrEditWindowExpired
	}

	// An edit leaves attachments alone, but the client swaps in the whole
	// message object from this response — so a caption edit must not drop the
	// photos it belongs to. The repository reloads them; here we only sign them.
	for i := range msg.Attachments {
		msg.Attachments[i] = s.presignAttachment(ctx, msg.Attachments[i])
	}

	s.hydrateAndPresignQuote(ctx, &msg)
	go s.publishMessageMutation(context.Background(), msg, "message.edited")

	return msg, nil
}

// DeleteMessage soft-deletes the caller's own message.
//
// The row survives: hard deletion would blank the quote of every reply pointing
// at it (ON DELETE SET NULL) and could leave last_read_message_id referencing a
// missing id. The body is cleared and attachment objects are removed from
// storage, so nothing recoverable stays behind — the client renders a
// "Сообщение удалено" placeholder in place of the bubble.
//
// Unlike editing, deletion stays allowed after the recipient has read the
// message: they already saw it, and removing it does not misrepresent what was
// said.
func (s *Service) DeleteMessage(ctx context.Context, userID int32, messageID int64) (domain.Message, error) {
	info, err := s.repo.GetMessageForMutation(ctx, messageID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Message{}, ErrMessageNotFound
		}
		return domain.Message{}, err
	}

	if info.SenderID == nil || *info.SenderID != userID {
		return domain.Message{}, domain.ErrBookingForbidden
	}
	if info.DeletedAt != nil {
		return domain.Message{}, ErrMessageAlreadyDeleted
	}
	if info.Kind != domain.MessageKindUser {
		// Booking cards are the audit trail of the deal; a participant must not
		// be able to erase them.
		return domain.Message{}, ErrMessageNotEditable
	}
	if time.Since(info.CreatedAt) > domain.MessageDeleteWindow {
		return domain.Message{}, ErrDeleteWindowExpired
	}

	msg, attachmentKeys, ok, err := s.repo.SoftDeleteMessage(ctx, messageID, userID, domain.MessageDeleteWindow)
	if err != nil {
		return domain.Message{}, err
	}
	if !ok {
		return domain.Message{}, ErrDeleteWindowExpired
	}

	// Drop the objects only after the row is committed. Doing it earlier would
	// risk deleting files for a message that still renders if the transaction
	// rolled back. Failures are logged, not surfaced: the message is already
	// gone from the user's perspective, and an orphaned object is a
	// housekeeping problem rather than a user-facing one.
	if len(attachmentKeys) > 0 {
		go func(keys []string) {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			for _, key := range keys {
				// Delete only what this user actually owns. The keys come from
				// the message's own attachment rows, but rows written before
				// ownership was enforced may point at somebody else's object,
				// and deleting one would destroy a file still referenced by a
				// conversation the deleter is not part of.
				//
				// A legacy key names no owner, so it is left in place: an
				// orphaned object costs storage, an over-eager delete costs
				// somebody their photo.
				if !ownsStoredAttachmentKey(key, userID) {
					reason := "not owned by this user"
					if isLegacyAttachmentKey(key) {
						reason = "legacy key with no recorded owner"
					}
					log.Printf("[Chat] Not deleting attachment %q of message %d (user %d): %s", key, messageID, userID, reason)
					continue
				}
				if err := s.storage.Delete(cleanupCtx, key); err != nil {
					log.Printf("[Chat] Failed to delete attachment %q of deleted message %d: %v", key, messageID, err)
				}
				if err := s.storage.Delete(cleanupCtx, key+".cover.jpg"); err != nil {
					log.Printf("[Chat] Failed to delete attachment cover %q of deleted message %d: %v", key+".cover.jpg", messageID, err)
				}
			}
		}(attachmentKeys)
	}

	go s.publishMessageMutation(context.Background(), msg, "message.deleted")

	return msg, nil
}

// publishMessageMutation broadcasts an edit or delete to the conversation
// channel and refreshes both participants' conversation lists.
//
// The conversation preview shows the last message, so editing or deleting it
// has to invalidate that list as well — otherwise the messages screen keeps
// showing text that no longer exists.
func (s *Service) publishMessageMutation(ctx context.Context, msg domain.Message, eventType string) {
	_ = s.centrifugoPublish(fmt.Sprintf("chat:conv_%d", msg.ConversationID), map[string]any{
		"type":    eventType,
		"message": msg,
	})

	if msg.SenderID == nil {
		return
	}
	recipientID, err := s.repo.GetOtherParticipantID(ctx, msg.ConversationID, *msg.SenderID)
	if err != nil {
		log.Printf("chat: failed to get recipient for mutation notification: %v", err)
		return
	}
	payload := map[string]any{
		"type":            "unread_update",
		"conversation_id": msg.ConversationID,
	}
	_ = s.centrifugoPublish(fmt.Sprintf("user:#%d", recipientID), payload)
	_ = s.centrifugoPublish(fmt.Sprintf("user:#%d", *msg.SenderID), payload)
}

func (s *Service) PresignUpload(ctx context.Context, userID int32, fileName string, size int64, contentType string) (domain.UploadTarget, error) {
	if userID <= 0 {
		return domain.UploadTarget{}, ErrInvalidAttachment
	}
	contentType = strings.ToLower(strings.TrimSpace(contentType))

	// 1. MIME whitelist check
	if !allowedUploadTypes[contentType] {
		return domain.UploadTarget{}, ErrFileTypeNotAllowed
	}

	isMotion := isVideoType(contentType) || contentType == "image/gif"

	// 2. Video and animated uploads are gated on account standing. A brand-new
	// or unverified account sending video is overwhelmingly a spam bot, and each
	// such upload costs frame extraction plus a vision call per frame — the most
	// expensive thing an anonymous actor can make this server do.
	if isMotion {
		allowed, err := s.canSendMotionMedia(ctx, userID)
		if err != nil {
			return domain.UploadTarget{}, err
		}
		if !allowed {
			return domain.UploadTarget{}, ErrMotionMediaNotAllowed
		}
	}

	// 3. Size check. Video gets its own, larger ceiling: even a 30-second 720p
	// clip does not fit the 15 MB used for photos and documents. The same
	// function decides the limit SendMessage enforces on the stored object, so
	// the policy and the acceptance check cannot drift apart.
	limit := attachmentSizeLimit(contentType)
	if size > limit {
		return domain.UploadTarget{}, ErrFileTooLarge
	}

	// 4. Generate secure random key path
	uuid, err := generateRandomHex(16)
	if err != nil {
		return domain.UploadTarget{}, err
	}
	// The owner segment is what makes the key checkable later: a key alone is a
	// bearer capability, a key with an owner in it is a claim we can verify
	// against whoever presents it.
	key := attachmentKey(userID, uuid, media.SafeExt(fileName))

	// 5. Generate presigned POST params. Pass the server-side limit (not the
	// client-claimed size) as the content-length-range upper bound: picker
	// sizes are unreliable, and S3 enforces this bound authoritatively.
	target, err := s.storage.PresignUpload(ctx, key, limit, contentType)
	if err != nil {
		return domain.UploadTarget{}, err
	}

	// The path shape is defence in depth, not ownership proof. Persist the
	// server-issued capability before returning it to the client; SendMessage
	// accepts only keys registered for the authenticated user.
	if err := s.repo.RegisterChatUpload(ctx, domain.ChatUpload{
		ObjectKey: key,
		OwnerID:   userID,
		SizeBytes: size,
		MimeType:  contentType,
	}); err != nil {
		return domain.UploadTarget{}, err
	}

	return target, nil
}

// canSendMotionMedia reports whether the account may upload video or animation.
//
// Two conditions, both cheap: the phone must be verified, and the account must
// be older than motionMediaMinAccountAge. The age floor is deliberately short —
// a legitimate owner wanting to send a room tour on their first day is a real
// case, so the bar is "not registered seconds ago", not "established user".
func (s *Service) canSendMotionMedia(ctx context.Context, userID int32) (bool, error) {
	standing, err := s.repo.GetUserMediaStanding(ctx, userID)
	if err != nil {
		return false, err
	}
	if standing.PhoneVerifiedAt == nil {
		return false, nil
	}
	return time.Since(standing.CreatedAt) >= motionMediaMinAccountAge, nil
}

// isVideoType reports whether the content type is a whitelisted video format.
func isVideoType(contentType string) bool {
	return strings.HasPrefix(contentType, "video/")
}

// attachmentSizeLimit is the ceiling for one stored object. It must agree with
// the limit PresignUpload puts in the POST policy: the policy is what S3
// enforces at upload time, and SendMessage deletes anything above the limit it
// applies here, so a stricter value here silently destroys files the server
// itself accepted.
func attachmentSizeLimit(contentType string) int64 {
	if isVideoType(strings.ToLower(strings.TrimSpace(contentType))) {
		return maxVideoBytes
	}
	return maxAttachmentBytes
}

// maxImageDimension bounds the width/height a client may record for an
// attachment. Generous next to what a phone camera produces (about 8000 px on
// the long side today) and far below anything that breaks a layout.
const maxImageDimension int32 = 20000

// plausibleDimension keeps a client-supplied pixel dimension only when it could
// describe a real image. Anything else becomes nil, which the client renders
// with its fixed fallback height.
func plausibleDimension(v *int32) *int32 {
	if v == nil || *v <= 0 || *v > maxImageDimension {
		return nil
	}
	return v
}

func (s *Service) publishMessage(ctx context.Context, msg domain.Message) {
	// A message whose media is still being checked or awaits manual retry must
	// not reach the recipient, and the conversation channel is shared by both
	// participants. The worker publishes it once every attachment has passed
	// (see PublishApprovedMessage). The sender already has it from the HTTP
	// response, so nothing is lost for them.
	publicMsg, deliverable := messageForRecipient(msg)
	if !deliverable {
		return
	}

	// 1. Publish to conversation channel (for users with chat open)
	channel := fmt.Sprintf("chat:conv_%d", publicMsg.ConversationID)
	payload := map[string]any{
		"type":    "message.new",
		"message": publicMsg,
	}
	_ = s.centrifugoPublish(channel, payload)

	// 2. Notify the recipient's personal channel (for conversation list updates)
	if publicMsg.SenderID == nil {
		return // system messages publish personal-channel updates themselves
	}
	recipientID, err := s.repo.GetOtherParticipantID(ctx, publicMsg.ConversationID, *publicMsg.SenderID)
	if err != nil {
		log.Printf("chat: failed to get recipient for personal notification: %v", err)
		return
	}
	personalChannel := fmt.Sprintf("user:#%d", recipientID)
	personalPayload := map[string]any{
		"type":            "unread_update",
		"conversation_id": publicMsg.ConversationID,
	}
	_ = s.centrifugoPublish(personalChannel, personalPayload)
	// The sender may have the app open on another device. Keep that device's
	// conversation preview in sync even though its unread count stays zero.
	_ = s.centrifugoPublish(fmt.Sprintf("user:#%d", *publicMsg.SenderID), personalPayload)
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
