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

// HostResponseStats summarizes how quickly a host replies to guest message
// batches in one-on-one conversations.
type HostResponseStats struct {
	AvgResponseMinutes int32 `json:"avg_response_minutes"`
	ResponsesCount     int32 `json:"responses_count"`
}
