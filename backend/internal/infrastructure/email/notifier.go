package email

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// NotifierConfig tunes preference gating and unsubscribe links.
type NotifierConfig struct {
	// Prefs gates non-transactional categories. May be nil: everything is
	// then treated as enabled (and unsubscribe links are still generated).
	Prefs domain.EmailPreferencesRepository
	// UnsubscribeBaseURL is the public API origin used to build unsubscribe
	// links, e.g. "https://api.example.com". Empty disables the footer link.
	UnsubscribeBaseURL string
	// UnsubscribeSecret signs unsubscribe links (HMAC-SHA256). Empty
	// disables the footer link.
	UnsubscribeSecret string
}

// Notifier implements domain.EmailNotifier on top of the durable Mailer.
// It renders templates, assigns dedup keys, checks per-user preferences for
// opt-outable categories, and skips silently when SMTP is not configured
// (dev environments), mirroring the previous inline behavior.
type Notifier struct {
	mailer   *Mailer
	renderer *renderer
	cfg      NotifierConfig
}

// NewNotifier fails only on template parse errors, i.e. at startup.
func NewNotifier(mailer *Mailer, cfg NotifierConfig) (*Notifier, error) {
	r, err := newRenderer()
	if err != nil {
		return nil, err
	}
	return &Notifier{mailer: mailer, renderer: r, cfg: cfg}, nil
}

// commonData is embedded into every template data struct so the shared
// layout can reference {{.UnsubscribeURL}} unconditionally. Transactional
// emails leave it empty and render no unsubscribe link.
type commonData struct {
	UnsubscribeURL string
}

var _ domain.EmailNotifier = (*Notifier)(nil)

func (n *Notifier) SendLoginCode(ctx context.Context, email, code string, ttl time.Duration) error {
	data := struct {
		commonData
		Code       string
		TTLMinutes int
	}{Code: code, TTLMinutes: int(ttl.Minutes())}

	return n.enqueue(ctx, OutboxMessage{
		// No dedup key: codes are intentionally repeatable (cooldown is
		// enforced by the auth service, not the outbox).
		Recipient: email,
		EventType: EventOTPCode,
		Subject:   "Код подтверждения для приложения Дом Рядом",
	}, data)
}

func (n *Notifier) NotifyBookingRequested(ctx context.Context, ownerEmail string, b domain.Booking) error {
	data := struct {
		commonData
		Address     string
		GuestName   string
		Dates       string
		GuestsCount int32
	}{
		Address:     bookingAddress(b),
		GuestName:   guestName(b),
		Dates:       bookingDates(b),
		GuestsCount: b.Count,
	}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d", EventBookingNew, b.ID),
		Recipient: ownerEmail,
		EventType: EventBookingNew,
		Subject:   "Новая заявка на бронирование — Дом Рядом",
	}, data)
}

func (n *Notifier) NotifyBookingConfirmed(ctx context.Context, b domain.Booking) error {
	data := struct {
		commonData
		Address string
		Dates   string
	}{Address: bookingAddress(b), Dates: bookingDates(b)}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d", EventBookingConfirmed, b.ID),
		UserID:    b.UserID,
		Recipient: b.Email,
		EventType: EventBookingConfirmed,
		Subject:   "Ваша заявка на бронирование подтверждена!",
	}, data)
}

func (n *Notifier) NotifyBookingRejected(ctx context.Context, b domain.Booking, reason string) error {
	data := struct {
		commonData
		Address string
		Dates   string
		Reason  string
	}{Address: bookingAddress(b), Dates: bookingDates(b), Reason: reason}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d", EventBookingRejected, b.ID),
		UserID:    b.UserID,
		Recipient: b.Email,
		EventType: EventBookingRejected,
		Subject:   "Ваша заявка на бронирование отклонена",
	}, data)
}

func (n *Notifier) NotifyBookingCancelled(ctx context.Context, ownerID int32, ownerEmail string, b domain.Booking) error {
	allowed, err := n.categoryEnabled(ctx, ownerID, domain.EmailCategoryBooking)
	if err != nil {
		return err
	}
	if !allowed {
		log.Printf("email: %s to user %d skipped (opted out)", EventBookingCancelled, ownerID)
		return nil
	}

	data := struct {
		commonData
		Address   string
		GuestName string
		Dates     string
	}{
		commonData: commonData{UnsubscribeURL: n.unsubscribeURL(ownerID, domain.EmailCategoryBooking)},
		Address:    bookingAddress(b),
		GuestName:  guestName(b),
		Dates:      bookingDates(b),
	}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d", EventBookingCancelled, b.ID),
		UserID:    ownerID,
		Recipient: ownerEmail,
		EventType: EventBookingCancelled,
		Subject:   "Гость отменил заявку на бронирование — ДомРядом",
	}, data)
}

// chatDigestWindow is the quiet period per conversation: within one window a
// burst of messages produces at most one email (enforced via the dedup key).
const chatDigestWindow = 30 * time.Minute

func (n *Notifier) NotifyChatMessage(ctx context.Context, recipientID int32, recipientEmail, senderName string, convID int64) error {
	allowed, err := n.categoryEnabled(ctx, recipientID, domain.EmailCategoryChatDigest)
	if err != nil {
		return err
	}
	if !allowed {
		log.Printf("email: %s to user %d skipped (opted out)", EventChatDigest, recipientID)
		return nil
	}

	if senderName == "" {
		senderName = "Пользователь"
	}
	data := struct {
		commonData
		SenderName string
	}{
		commonData: commonData{UnsubscribeURL: n.unsubscribeURL(recipientID, domain.EmailCategoryChatDigest)},
		SenderName: senderName,
	}

	// The time bucket in the dedup key implements the quiet window: all
	// messages in the same conversation within one bucket collapse into a
	// single queued email.
	bucket := time.Now().Unix() / int64(chatDigestWindow.Seconds())
	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d:%d:%d", EventChatDigest, convID, recipientID, bucket),
		UserID:    recipientID,
		Recipient: recipientEmail,
		EventType: EventChatDigest,
		Subject:   "Новое сообщение в чате — ДомРядом",
	}, data)
}

func (n *Notifier) SendWelcome(ctx context.Context, userID int32, email string) error {
	data := struct {
		commonData
	}{}

	return n.enqueue(ctx, OutboxMessage{
		// Dedup per user: re-login flows can never produce a second welcome.
		DedupKey:  fmt.Sprintf("%s:%d", EventWelcome, userID),
		UserID:    userID,
		Recipient: email,
		EventType: EventWelcome,
		Subject:   "Добро пожаловать в «ДомРядом»!",
	}, data)
}

func (n *Notifier) NotifyReviewReceived(ctx context.Context, ownerID int32, ownerEmail string, reviewID int64, rating int32, address string) error {
	allowed, err := n.categoryEnabled(ctx, ownerID, domain.EmailCategoryReviews)
	if err != nil {
		return err
	}
	if !allowed {
		log.Printf("email: %s to user %d skipped (opted out)", EventReviewReceived, ownerID)
		return nil
	}

	data := struct {
		commonData
		Rating  int32
		Address string
	}{
		commonData: commonData{UnsubscribeURL: n.unsubscribeURL(ownerID, domain.EmailCategoryReviews)},
		Rating:     rating,
		Address:    address,
	}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d", EventReviewReceived, reviewID),
		UserID:    ownerID,
		Recipient: ownerEmail,
		EventType: EventReviewReceived,
		Subject:   "У вас новый отзыв — ДомРядом",
	}, data)
}

func (n *Notifier) NotifyReviewModerated(ctx context.Context, authorID int32, authorEmail string, reviewID int64, status, targetType, reason string) error {
	allowed, err := n.categoryEnabled(ctx, authorID, domain.EmailCategoryReviews)
	if err != nil {
		return err
	}
	if !allowed {
		log.Printf("email: %s to user %d skipped (opted out)", EventReviewModerated, authorID)
		return nil
	}

	contentName := "отзыв"
	if targetType == "reply" {
		contentName = "ответ на отзыв"
	}
	title := "Материал ожидает дополнительной проверки"
	message := "Мы сообщим о результате после завершения проверки."
	subject := "Материал ожидает проверки — ДомРядом"
	switch status {
	case "active":
		title = "Ваш " + contentName + " опубликован"
		message = "Теперь он доступен другим пользователям в приложении."
		subject = title + " — ДомРядом"
	case "rejected":
		title = "Ваш " + contentName + " не прошёл проверку"
		message = "Исправьте текст с учётом причины и отправьте его повторно."
		subject = title + " — ДомРядом"
	}

	data := struct {
		commonData
		Title   string
		Message string
		Reason  string
	}{
		commonData: commonData{UnsubscribeURL: n.unsubscribeURL(authorID, domain.EmailCategoryReviews)},
		Title:      title,
		Message:    message,
		Reason:     reason,
	}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%s:%d:%s", EventReviewModerated, targetType, reviewID, status),
		UserID:    authorID,
		Recipient: authorEmail,
		EventType: EventReviewModerated,
		Subject:   subject,
	}, data)
}

// NotifyListingApproved tells the owner their listing passed moderation and
// is now published. Transactional (no opt-out); deduped per house+day so a
// re-check after LLM recovery cannot double-mail.
func (n *Notifier) NotifyListingApproved(ctx context.Context, ownerID int32, ownerEmail string, houseID int32, address string) error {
	data := struct {
		commonData
		Address string
	}{Address: address}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d:%s", EventListingApproved, houseID, time.Now().Format("2006-01-02")),
		UserID:    ownerID,
		Recipient: ownerEmail,
		EventType: EventListingApproved,
		Subject:   "Ваше объявление опубликовано — ДомРядом",
	}, data)
}

// NotifyListingRejected tells the owner their listing failed moderation, with
// the reason. Transactional; deduped per house+day.
func (n *Notifier) NotifyListingRejected(ctx context.Context, ownerID int32, ownerEmail string, houseID int32, address, reason string) error {
	data := struct {
		commonData
		Address string
		Reason  string
	}{Address: address, Reason: reason}

	return n.enqueue(ctx, OutboxMessage{
		DedupKey:  fmt.Sprintf("%s:%d:%s", EventListingRejected, houseID, time.Now().Format("2006-01-02")),
		UserID:    ownerID,
		Recipient: ownerEmail,
		EventType: EventListingRejected,
		Subject:   "Объявление не прошло проверку — ДомРядом",
	}, data)
}

// AdminNotifier wraps a Notifier with a fixed admin recipient for
// operational alerts. Satisfies moderation.AdminAlerter.
type AdminNotifier struct {
	n     *Notifier
	email string
}

// NewAdminNotifier returns nil when adminEmail is empty (alerts disabled).
func NewAdminNotifier(n *Notifier, adminEmail string) *AdminNotifier {
	if adminEmail == "" {
		return nil
	}
	return &AdminNotifier{n: n, email: adminEmail}
}

// SendAdminAlert queues an operational alert. dedupKey scopes suppression
// (e.g. one degraded-mode alert per day).
func (a *AdminNotifier) SendAdminAlert(ctx context.Context, dedupKey, subject, body string) error {
	data := struct {
		commonData
		Title string
		Body  string
	}{Title: subject, Body: body}

	return a.n.enqueue(ctx, OutboxMessage{
		DedupKey:  EventAdminAlert + ":" + dedupKey,
		Recipient: a.email,
		EventType: EventAdminAlert,
		Subject:   subject + " — ДомРядом",
	}, data)
}

// categoryEnabled consults the user's stored preferences. Errors are treated
// as "enabled" so a prefs outage never silently drops notifications — but the
// error is still returned to the caller's log via nil handling here.
func (n *Notifier) categoryEnabled(ctx context.Context, userID int32, cat domain.EmailCategory) (bool, error) {
	if n.cfg.Prefs == nil || userID == 0 {
		return true, nil
	}
	p, err := n.cfg.Prefs.Get(ctx, userID)
	if err != nil {
		log.Printf("email: prefs lookup for user %d failed, sending anyway: %v", userID, err)
		return true, nil
	}
	switch cat {
	case domain.EmailCategoryBooking:
		return p.Booking, nil
	case domain.EmailCategoryChatDigest:
		return p.ChatDigest, nil
	case domain.EmailCategoryReviews:
		return p.Reviews, nil
	default:
		return true, nil
	}
}

// unsubscribeURL builds an HMAC-signed opt-out link that works without login.
// Returns "" (no link rendered) when the base URL or secret is not configured.
func (n *Notifier) unsubscribeURL(userID int32, cat domain.EmailCategory) string {
	if n.cfg.UnsubscribeBaseURL == "" || n.cfg.UnsubscribeSecret == "" || userID == 0 {
		return ""
	}
	sig := UnsubscribeSignature(n.cfg.UnsubscribeSecret, userID, cat)
	return fmt.Sprintf("%s/api/v1/email/unsubscribe?uid=%d&cat=%s&sig=%s",
		strings.TrimRight(n.cfg.UnsubscribeBaseURL, "/"), userID, cat, sig)
}

// UnsubscribeSignature computes the HMAC-SHA256 hex signature for an
// unsubscribe link. Exported so the HTTP handler verifies with the same code.
func UnsubscribeSignature(secret string, userID int32, cat domain.EmailCategory) string {
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "unsubscribe:%d:%s", userID, cat)
	return hex.EncodeToString(mac.Sum(nil))
}

// enqueue renders the event and persists it into the outbox. All EmailNotifier
// methods funnel through here so skip/log behavior stays consistent.
func (n *Notifier) enqueue(ctx context.Context, msg OutboxMessage, data any) error {
	if msg.Recipient == "" {
		return nil // guest bookings may have no email; nothing to send
	}
	if !n.mailer.Configured() {
		log.Printf("email: SMTP not configured, skipping %s to %s",
			msg.EventType, domain.MaskEmail(msg.Recipient))
		return nil
	}

	textBody, htmlBody, err := n.renderer.render(msg.EventType, data)
	if err != nil {
		return err
	}
	msg.BodyText = textBody
	msg.BodyHTML = htmlBody

	inserted, err := n.mailer.Enqueue(ctx, msg)
	if err != nil {
		return fmt.Errorf("enqueue %s: %w", msg.EventType, err)
	}
	if !inserted {
		log.Printf("email: %s to %s already queued/sent (dedup), skipping",
			msg.EventType, domain.MaskEmail(msg.Recipient))
	}
	return nil
}

// bookingAddress renders the listing address for email copy, degrading
// gracefully when the house summary is missing.
func bookingAddress(b domain.Booking) string {
	if b.House == nil {
		return "из вашей заявки"
	}
	parts := make([]string, 0, 3)
	if b.House.City != "" {
		parts = append(parts, b.House.City)
	}
	street := strings.TrimSpace(b.House.Street + " " + b.House.HouseNumber)
	if street != "" {
		parts = append(parts, street)
	}
	if len(parts) == 0 {
		return "из вашей заявки"
	}
	return strings.Join(parts, ", ")
}

// bookingDates formats the stay range in Russian date notation.
func bookingDates(b domain.Booking) string {
	const layout = "02.01.2006"
	if b.StartDate.IsZero() {
		return ""
	}
	if b.EndDate == nil {
		return b.StartDate.Format(layout)
	}
	return b.StartDate.Format(layout) + " — " + b.EndDate.Format(layout)
}

// guestName builds a display name for the booking author without leaking
// more personal data than the owner already sees in the app.
func guestName(b domain.Booking) string {
	name := strings.TrimSpace(strings.TrimSpace(b.Name) + " " + strings.TrimSpace(b.Surname))
	if name == "" {
		return "Гость"
	}
	return name
}
