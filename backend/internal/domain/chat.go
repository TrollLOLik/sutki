package domain

import (
	"context"
	"encoding/json"
	"time"
)

// Message kinds. User messages are the default; system kinds are created
// exclusively by backend use cases (never accepted from clients).
const (
	MessageKindUser          = "user"
	MessageKindBookingStatus = "booking_status"
)

// Booking card events carried in the booking_status payload.
const (
	BookingEventNew       = "new"
	BookingEventConfirmed = "confirmed"
	BookingEventRejected  = "rejected"
	BookingEventCancelled = "cancelled"
)

// Editing and deletion windows for user messages.
//
// Editing is deliberately the shorter of the two and additionally forbidden
// once the recipient has read the message (see chat.ErrMessageAlreadyRead).
// This is a booking conversation: silently rewriting an agreed "5000 ₽" into
// "7000 ₽" after the other party read it must not be possible. Deletion has a
// longer window because it destroys the text instead of substituting it, and
// the recipient always sees that something was removed.
const (
	MessageEditWindow   = 15 * time.Minute
	MessageDeleteWindow = 60 * time.Minute
)

// BookingStatusPayload is the machine-readable content of a booking_status
// system message. Address is only populated for the confirmed event (the
// exact apartment number stays private until the owner approves).
type BookingStatusPayload struct {
	RequestID int32  `json:"request_id"`
	Event     string `json:"event"`
	StartDate string `json:"start_date,omitempty"`
	EndDate   string `json:"end_date,omitempty"`
	Guests    int32  `json:"guests,omitempty"`
	Reason    string `json:"reason,omitempty"`
	Address   string `json:"address,omitempty"`
}

// ChatSystemPoster posts server-generated system messages into the
// conversation between a listing owner and a guest, creating the
// conversation if it does not exist yet. Implemented by the chat service;
// consumed by the booking use case so booking never depends on chat directly.
type ChatSystemPoster interface {
	PostBookingStatus(ctx context.Context, houseID, ownerID, guestID int32, payload BookingStatusPayload) error
}

// Conversation represents a chat room between participants
type Conversation struct {
	ID        int64
	HouseID   *int32 // Nullable context for the chat (nil for general chat)
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ConversationParticipant represents a user participating in a conversation
type ConversationParticipant struct {
	ConversationID    int64
	UserID            int32
	LastReadAt        time.Time
	LastReadMessageID int64
}

// Attachment moderation states.
//
// Video cannot be checked inside the send request: sampling frames plus a vision
// call per frame takes tens of seconds. So an attachment is stored first and
// verified after — the sender sees "Проверяется", the recipient sees nothing
// until the verdict lands.
const (
	AttachmentModerationPending  = "pending"
	AttachmentModerationApproved = "approved"
	AttachmentModerationRejected = "rejected"
)

// Attachment kinds for the moderation queue: how the file has to be inspected.
//
// An image goes to the model as-is. Video and animated images are sampled into
// frames first — a vision model shown an animated GIF effectively looks at its
// first frame only, which is exactly how "safe cover, violation at second three"
// used to slip through.
const (
	AttachmentKindImage    = "image"
	AttachmentKindVideo    = "video"
	AttachmentKindAnimated = "animated"
)

// MessageAttachment represents a file or image attachment linked to a message
type MessageAttachment struct {
	ID        int64     `json:"id"`
	MessageID int64     `json:"message_id"`
	URL       string    `json:"url"`
	FileName  string    `json:"file_name"`
	MimeType  string    `json:"mime_type"`
	SizeBytes int64     `json:"size_bytes"`
	Width     *int32    `json:"width,omitempty"`
	Height    *int32    `json:"height,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	// ModerationStatus is pending/approved/rejected. Clients render a
	// "Проверяется" placeholder for pending attachments of their own messages.
	ModerationStatus string `json:"moderation_status"`
	// DurationSeconds is set for video only.
	DurationSeconds *int32 `json:"duration_seconds,omitempty"`
	// ThumbnailURL is a presigned cover image for video. The feed shows this
	// still with a play button; the player opens on tap. Rendering video inline
	// would put several decoders on screen and destroy scrolling.
	ThumbnailURL string `json:"thumbnail_url,omitempty"`
}

// IsPendingModeration reports whether the attachment is still being checked.
func (a MessageAttachment) IsPendingModeration() bool {
	return a.ModerationStatus == AttachmentModerationPending
}

// UserMediaStanding is the account data behind the video upload gate.
type UserMediaStanding struct {
	PhoneVerifiedAt *time.Time
	CreatedAt       time.Time
}

// AttachmentModerationJob is one queued attachment check.
//
// One job per attachment rather than per message: in a ten-photo album each
// check is independent, and one failure must not retry the other nine.
type AttachmentModerationJob struct {
	ID             int64
	AttachmentID   int64
	MessageID      int64
	ConversationID int64
	ObjectKey      string
	MimeType       string
	Kind           string
	Attempts       int32
}

// MessageQuote is the compact form of a quoted message, embedded into every
// reply the API returns.
//
// Replies carry their quote pre-hydrated instead of letting the client look the
// parent up in its own cache: history is paginated (20 messages per page), so
// the parent of a reply is frequently outside the loaded window. Resolving it
// client-side would either render an empty quote or force an extra round trip
// per reply.
//
// BodyPreview is truncated server-side (see MessageQuotePreviewLimit) — a quote
// renders as one or two lines, so shipping a 4000-character body would waste
// bandwidth on every page of history.
type MessageQuote struct {
	ID       int64  `json:"id"`
	SenderID *int32 `json:"sender_id,omitempty"`
	Kind     string `json:"kind"`
	// BodyPreview is empty when the quoted message carries only attachments.
	BodyPreview string `json:"body_preview"`
	// AttachmentCount lets the client render "3 фото" without shipping every
	// attachment of the parent.
	AttachmentCount int32 `json:"attachment_count"`
	// FirstAttachmentURL is a presigned thumbnail of the first attachment,
	// populated only when that attachment is an image.
	FirstAttachmentURL string `json:"first_attachment_url,omitempty"`
	// Deleted marks a quote whose parent was soft-deleted. The client shows
	// "Сообщение удалено" instead of stale text.
	Deleted bool `json:"deleted"`
}

// MessageQuotePreviewLimit caps the quoted body length in runes.
const MessageQuotePreviewLimit = 120

// MessageMutationInfo is what authorizing an edit or a delete needs, gathered
// in a single query so a rejected request costs one round trip instead of three.
type MessageMutationInfo struct {
	ID              int64
	ConversationID  int64
	SenderID        *int32
	Kind            string
	Body            *string
	CreatedAt       time.Time
	EditedAt        *time.Time
	DeletedAt       *time.Time
	AttachmentCount int64
	// OtherLastReadMessageID is the read cursor of the other participant, or 0
	// when they have read nothing. Editing is refused once this reaches the
	// message being edited.
	OtherLastReadMessageID int64
}

// IsReadByOther reports whether the other participant has already read this
// message.
func (m MessageMutationInfo) IsReadByOther() bool {
	return m.OtherLastReadMessageID >= m.ID
}

// Message represents a text message optionally containing S3 attachments.
// SenderID is nil for system messages (kind != "user"); Payload carries the
// machine-readable card data for system kinds.
type Message struct {
	ID             int64               `json:"id"`
	ConversationID int64               `json:"conversation_id"`
	SenderID       *int32              `json:"sender_id"`
	Kind           string              `json:"kind"`
	Payload        json.RawMessage     `json:"payload,omitempty"`
	Body           *string             `json:"body,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	Attachments    []MessageAttachment `json:"attachments,omitempty"`
	// ReplyToMessageID is set when this message answers another one in the same
	// conversation. It survives deletion of the parent (ON DELETE SET NULL
	// clears it only if the row is hard-deleted, which we never do).
	ReplyToMessageID *int64 `json:"reply_to_message_id,omitempty"`
	// ReplyTo is the hydrated quote for ReplyToMessageID. Nil when the message
	// is not a reply.
	ReplyTo *MessageQuote `json:"reply_to,omitempty"`
	// EditedAt is non-nil once the body was edited; the client renders "(ред.)".
	EditedAt *time.Time `json:"edited_at,omitempty"`
	// DeletedAt marks a soft-deleted message. Body and attachments are cleared,
	// but the row stays so replies keep their quote and read cursors stay valid.
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}

// ConversationSummary represents a conversation list item with unread counts and last message preview
type ConversationSummary struct {
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

// ConversationPresence combines live Centrifugo presence with the durable
// heartbeat used after the other participant disconnects.
type ConversationPresence struct {
	Online     bool       `json:"online"`
	LastSeenAt *time.Time `json:"last_seen_at,omitempty"`
}

// SuggestionContext is what generating reply suggestions needs about a
// conversation: the listing behind it, who owns that listing, and the current
// tail of the dialog.
//
// HouseID is nil for general conversations — suggestions are only generated for
// listing-scoped dialogs, where there is something concrete to suggest about.
type SuggestionContext struct {
	HouseID        *int32
	OwnerID        int32
	City           string
	Street         string
	CountRoom      string
	Price          int32
	MaxGuests      int32
	CheckInAfter   string
	CheckOutBefore string
	// LastMessageID doubles as the cache key: while it does not change, the
	// conversation has not moved and the previous suggestions still apply.
	LastMessageID int64
	// Messages is the tail of the dialog, oldest first.
	Messages []SuggestionMessage
}

// SuggestionMessage is one dialog line handed to the model.
type SuggestionMessage struct {
	SenderID *int32
	Kind     string
	Body     string
}

// HostResponseStats summarizes how quickly a host replies to guest message
// batches in one-on-one conversations.
type HostResponseStats struct {
	AvgResponseMinutes int32 `json:"avg_response_minutes"`
	ResponsesCount     int32 `json:"responses_count"`
}
