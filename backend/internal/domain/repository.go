package domain

import (
	"context"
	"time"
)

// BookedRange is an occupancy window on a listing returned by
// BlockingRanges. Status distinguishes BLOCK (confirmed, active) from
// WARN (in_progress, pending) ranges.
// Interval is half-open [Start, End): End is the checkout day, free for
// same-day turnover. End is nil only for legacy single-night rows.
type BookedRange struct {
	Start  time.Time
	End    *time.Time
	Status string
}

// ListingRepository abstracts persistence for rental listings.
type ListingRepository interface {
	List(ctx context.Context, filter ListFilter) ([]House, error)
	Count(ctx context.Context, filter ListFilter) (int64, error)
	Create(ctx context.Context, h NewHouse) (int32, error)
	ListByOwner(ctx context.Context, ownerID, limit, offset int32) ([]House, error)
	CountByOwner(ctx context.Context, ownerID int32) (int64, error)
	GetByID(ctx context.Context, id int32) (House, error)
	ListPhotos(ctx context.Context, houseID int32) ([]Photo, error)
	ListServices(ctx context.Context, houseID int32) ([]Ref, error)
	ListCategories(ctx context.Context, houseID int32) ([]Ref, error)
	AllServices(ctx context.Context) ([]Ref, error)
	AllCategories(ctx context.Context) ([]Ref, error)
	Update(ctx context.Context, id int32, h NewHouse) error
	UpdateReviewsSummary(ctx context.Context, id int32, summary *string) error
	UpdateLocationSummary(ctx context.Context, id int32, summary *string) error
	// UserHasConfirmedBooking returns true when userID has a confirmed or
	// active booking for houseID.  Used by the detail endpoint to decide
	// whether to return exact vs. fuzzed coordinates.
	UserHasConfirmedBooking(ctx context.Context, userID, houseID int32) (bool, error)
}

// BookingRepository abstracts persistence for rental requests (bookings).
type BookingRepository interface {
	GetHouseForBooking(ctx context.Context, houseID int32) (ownerID int32, status string, ownerEmail string, err error)
	// HasConfirmedOverlap reports whether the house already has a confirmed
	// booking overlapping [start, end). A nil end means a single night.
	HasConfirmedOverlap(ctx context.Context, houseID int32, start time.Time, end *time.Time) (bool, error)
	// BlockingRanges returns the house's date ranges across all non-terminal
	// statuses so the client can separate BLOCK (confirmed, active) from WARN
	// (in_progress, pending) ranges for calendar display.
	BlockingRanges(ctx context.Context, houseID int32) ([]BookedRange, error)
	Create(ctx context.Context, b NewBooking) (Booking, error)
	GetByID(ctx context.Context, id int32) (Booking, error)
	ListByUser(ctx context.Context, userID, limit, offset int32, scope string) ([]Booking, error)
	CountByUser(ctx context.Context, userID int32, scope string) (int64, error)
	ListForOwner(ctx context.Context, ownerID, limit, offset int32) ([]Booking, error)
	CountForOwner(ctx context.Context, ownerID int32) (int64, error)
	ListByGuest(ctx context.Context, guestID string, limit, offset int32) ([]Booking, error)
	CountByGuest(ctx context.Context, guestID string) (int64, error)
	DeleteExpiredPendingRequests(ctx context.Context, before time.Time) error
	Confirm(ctx context.Context, id int32) (Booking, error)
	Reject(ctx context.Context, id int32, reason string) (Booking, error)
	Cancel(ctx context.Context, id int32) (Booking, error)
}

// ReviewRepository abstracts persistence for listing reviews.
type ReviewRepository interface {
	HouseExists(ctx context.Context, houseID int32) (bool, error)
	ListByHouse(ctx context.Context, houseID, limit, offset int32) ([]Review, error)
	CountByHouse(ctx context.Context, houseID int32) (int64, error)
	Summary(ctx context.Context, houseID int32) (RatingSummary, error)
	Create(ctx context.Context, r NewReview) (Review, error)
	CreatePending(ctx context.Context, r NewReview, contentHash, maskedBody string, categories []string) (Review, error)
	Eligibility(ctx context.Context, requestID, userID int32) (ReviewEligibility, error)
	ListEligibility(ctx context.Context, userID int32) ([]ReviewEligibility, error)
	CreateReply(ctx context.Context, reviewID, ownerID int32, body, contentHash, maskedBody string, categories []string) (ReviewReply, error)
	DueModerationJobs(ctx context.Context, limit int32) ([]ReviewModerationJob, error)
	LoadModerationTarget(ctx context.Context, job ReviewModerationJob) (ReviewModerationTarget, error)
	CompleteModeration(ctx context.Context, job ReviewModerationJob, decision, category, reason string, confidence float32, raw []byte) error
	RetryModeration(ctx context.Context, job ReviewModerationJob, lastError string, next time.Time) error
	DueSummaryHouses(ctx context.Context, limit int32) ([]int32, error)
	CompleteSummary(ctx context.Context, houseID int32) error
	RetrySummary(ctx context.Context, houseID int32, lastError string, next time.Time) error
	ListByAuthor(ctx context.Context, userID, limit, offset int32) ([]Review, error)
	CountByAuthor(ctx context.Context, userID int32) (int64, error)
	ListForHost(ctx context.Context, userID, limit, offset int32) ([]Review, error)
	CountForHost(ctx context.Context, userID int32) (int64, error)
	SummaryForHost(ctx context.Context, ownerID int32) (RatingSummary, error)
}

// FavoriteRepository abstracts persistence for a user's favorite listings.
type FavoriteRepository interface {
	HouseExists(ctx context.Context, houseID int32) (bool, error)
	Add(ctx context.Context, userID, houseID int32) error
	Remove(ctx context.Context, userID, houseID int32) error
	ListHouses(ctx context.Context, userID, limit, offset int32) ([]House, error)
	CountHouses(ctx context.Context, userID int32) (int64, error)
	ListIDs(ctx context.Context, userID int32) ([]int32, error)
}

// UserRepository abstracts persistence for application accounts.
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByPhone(ctx context.Context, phone string) (User, error)
	GetByID(ctx context.Context, id int32) (User, error)
	Create(ctx context.Context, email string) (User, error)
	CreateWithPhone(ctx context.Context, phone string) (User, error)
	UpdateProfile(ctx context.Context, id int32, name, surname, patronymic, phone, city, avatarURL *string, birthday *time.Time, vkID *string, vkIDDoNull *bool) (User, error)
	UpdatePhone(ctx context.Context, id int32, phone, phoneNormalized string, verifiedAt time.Time) (User, error)
	UpdateEmail(ctx context.Context, id int32, email string) (User, error)
	// LinkGuestRequests attaches pending_verification guest requests matching
	// email to userID (moving them to in_progress) and returns the linked
	// request IDs so callers can fire owner notifications for each.
	LinkGuestRequests(ctx context.Context, userID int32, email string) ([]int32, error)
	LinkGuestRequestsByPhone(ctx context.Context, userID int32, phone string) ([]int32, error)
	Delete(ctx context.Context, id int32) error
	CheckActiveBookings(ctx context.Context, id int32) (int64, error)
	AnonymizeAndRevoke(ctx context.Context, id int32, emailHash string) error
}

// AuthCodeRepository persists short-lived email/phone login codes.
type AuthCodeRepository interface {
	Upsert(ctx context.Context, code AuthCode) error
	Get(ctx context.Context, channel, target string) (AuthCode, error)
	IncrementAttempts(ctx context.Context, channel, target string) error
	Delete(ctx context.Context, channel, target string) error
}

// PhoneChallengeRepository stores phone verification state separately from
// email auth codes and keeps delivery idempotency durable across HTTP retries.
type PhoneChallengeRepository interface {
	ReapStale(ctx context.Context, now time.Time) error
	GetActive(ctx context.Context, phone, purpose string) (PhoneChallenge, error)
	GetByID(ctx context.Context, id string) (PhoneChallenge, error)
	CreatePending(ctx context.Context, challenge PhoneChallenge, delivery PhoneChallengeDelivery) error
	GetPendingDelivery(ctx context.Context, challengeID string) (PhoneChallengeDelivery, error)
	BeginDelivery(ctx context.Context, challengeID, provider, mode, idempotencyID string, pendingUntil time.Time) (PhoneChallengeDelivery, error)
	MarkReady(ctx context.Context, challengeID, codeHash string, codeLength int32, mode, providerDeliveryID string, expiresAt time.Time) error
	MarkDeliveryFailed(ctx context.Context, challengeID string, errorCode, errorMessage *string) error
	IncrementAttempts(ctx context.Context, challengeID string) error
	MarkVerified(ctx context.Context, challengeID string) error
	MarkExpired(ctx context.Context, challengeID string) error
}

// RefreshTokenRepository persists hashed refresh tokens for JWT rotation.
type RefreshTokenRepository interface {
	Create(ctx context.Context, userID int32, tokenHash string, expiresAt time.Time, deviceName, deviceOS, appVersion, ipAddress, location *string) (int64, error)
	Get(ctx context.Context, tokenHash string) (RefreshToken, error)
	GetByID(ctx context.Context, id int64) (RefreshToken, error)
	Revoke(ctx context.Context, tokenHash string) error
	RevokeByID(ctx context.Context, id int64, userID int32) error
	RevokeAllExcept(ctx context.Context, currentID int64, userID int32) error
	UpdateActiveTime(ctx context.Context, id int64, lastActive time.Time) error
	UpdateLocation(ctx context.Context, id int64, location string) error
	ListActive(ctx context.Context, userID int32) ([]RefreshToken, error)
}

// ChatRepository abstracts persistence for real-time messaging
type ChatRepository interface {
	FindOrCreateConversation(ctx context.Context, houseID *int32, user1, user2 int32) (int64, error)
	// CanContact reports whether initiatorID has a legitimate reason to open a
	// conversation with targetID: an existing conversation between them, a
	// listing contact (targetID owns houseID), or a booking relationship in
	// either direction.
	CanContact(ctx context.Context, houseID *int32, initiatorID, targetID int32) (bool, error)
	CreateMessage(ctx context.Context, convID int64, senderID int32, body *string, attachments []MessageAttachment) (Message, error)
	// CreateSystemMessage inserts a server-generated message (sender_id NULL)
	// with the given kind/payload and a human-readable fallback body. Returns
	// created=false without error when the unique (conversation, request,
	// event) guard already holds a card for this payload.
	CreateSystemMessage(ctx context.Context, convID int64, kind string, payload []byte, fallbackBody string) (msg Message, created bool, err error)
	ListUserConversations(ctx context.Context, userID int32) ([]ConversationSummary, error)
	GetHostResponseStats(ctx context.Context, hostID int32) (HostResponseStats, error)
	GetConversationMessages(ctx context.Context, convID int64, cursorMessageID int64, limit int32) ([]Message, error)
	UpdateLastReadMessage(ctx context.Context, messageID int64, convID int64, userID int32) error
	CheckParticipantExists(ctx context.Context, convID int64, userID int32) (bool, error)
	IsOtherParticipantDeleted(ctx context.Context, convID int64, userID int32) (bool, error)
	GetOtherParticipantID(ctx context.Context, convID int64, userID int32) (int32, error)
	// GetChatEmailInfo returns what the email notification needs about a
	// conversation: the other participant's id and email, plus the sender's
	// display name. recipientEmail is empty for deleted/disabled recipients.
	GetChatEmailInfo(ctx context.Context, convID int64, senderID int32) (recipientID int32, recipientEmail, senderName string, err error)
}
