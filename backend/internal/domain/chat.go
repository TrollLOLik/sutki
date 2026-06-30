package domain

import "time"

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
	ID        int64  `json:"id"`
	MessageID int64  `json:"message_id"`
	URL       string `json:"url"`
	FileName  string `json:"file_name"`
	MimeType  string `json:"mime_type"`
	SizeBytes int64  `json:"size_bytes"`
	Width     *int32 `json:"width,omitempty"`
	Height    *int32 `json:"height,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// Message represents a text message optionally containing S3 attachments
type Message struct {
	ID             int64               `json:"id"`
	ConversationID int64               `json:"conversation_id"`
	SenderID       int32               `json:"sender_id"`
	Body           *string             `json:"body,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	Attachments    []MessageAttachment `json:"attachments,omitempty"`
}

// ConversationSummary represents a conversation list item with unread counts and last message preview
type ConversationSummary struct {
	ConversationID       int64      `json:"conversation_id"`
	HouseID              *int32     `json:"house_id,omitempty"`
	LastActivity         time.Time  `json:"last_activity"`
	UnreadCount          int64      `json:"unread_count"`
	LastMessageID          *int64     `json:"last_message_id,omitempty"`
	LastMessageBody        string     `json:"last_message_body"`
	LastMessageSenderID    *int32     `json:"last_message_sender_id,omitempty"`
	LastMessageCreatedAt   *time.Time `json:"last_message_created_at,omitempty"`
	OtherLastReadMessageID *int64     `json:"other_last_read_message_id,omitempty"`
	OtherUserID            int32      `json:"other_user_id"`
	OtherUserName          string     `json:"other_user_name"`
	OtherUserSurname       string     `json:"other_user_surname"`
	OtherUserAvatarUrl     string     `json:"other_user_avatar_url"`
	OtherUserDeleted       bool       `json:"other_user_deleted"`
	HouseStreet            *string    `json:"house_street,omitempty"`
	HouseNumber            *string    `json:"house_number,omitempty"`
	HouseCountRoom         *string    `json:"house_count_room,omitempty"`
	HousePrice             *int32     `json:"house_price,omitempty"`
	HouseCoverPath         string     `json:"house_cover_path"`
}
