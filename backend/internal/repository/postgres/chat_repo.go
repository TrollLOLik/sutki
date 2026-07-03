package postgres

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
)

type ChatRepo struct {
	q *sqlc.Queries
}

func NewChatRepo(q *sqlc.Queries) *ChatRepo {
	return &ChatRepo{q: q}
}

func generateAdvisoryLockKey(houseID int32, user1, user2 int32) int64 {
	uMin := user1
	uMax := user2
	if uMin > uMax {
		uMin, uMax = uMax, uMin
	}
	h := fnv.New64a()
	_, _ = h.Write([]byte(fmt.Sprintf("%d-%d-%d", houseID, uMin, uMax)))
	return int64(h.Sum64())
}

// CanContact reports whether initiatorID has a legitimate relationship with
// targetID that justifies opening a conversation: an existing conversation
// between the two, a listing contact (targetID owns the referenced house), or
// a booking relationship in either direction. Prevents authenticated users
// from spamming arbitrary user IDs.
func (r *ChatRepo) CanContact(ctx context.Context, houseID *int32, initiatorID, targetID int32) (bool, error) {
	const q = `
SELECT
  EXISTS (
    SELECT 1
    FROM conversation_participant cp1
    JOIN conversation_participant cp2 ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = $1 AND cp2.user_id = $2
  )
  OR ($3::int IS NOT NULL AND EXISTS (
    SELECT 1 FROM house h WHERE h.id = $3 AND h.owner_id = $2 AND h.deleted = false
  ))
  OR EXISTS (
    SELECT 1
    FROM request req
    JOIN house h ON h.id = req.house_id
    WHERE (req.user_id = $1 AND h.owner_id = $2)
       OR (req.user_id = $2 AND h.owner_id = $1)
  )`
	var allowed bool
	if err := r.q.DB().QueryRow(ctx, q, initiatorID, targetID, houseID).Scan(&allowed); err != nil {
		return false, err
	}
	return allowed, nil
}

func (r *ChatRepo) FindOrCreateConversation(ctx context.Context, houseID *int32, user1, user2 int32) (int64, error) {
	if user1 == user2 {
		return 0, errors.New("нельзя начать чат с самим собой")
	}

	type TxBeginner interface {
		Begin(ctx context.Context) (pgx.Tx, error)
	}

	db := r.q.DB()
	txb, ok := db.(TxBeginner)
	if !ok {
		return 0, errors.New("underlying database connection does not support transactions")
	}

	tx, err := txb.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	// Acquire Postgres advisory lock on the conversation signature to prevent race condition
	var sentinelHouseID int32 = 0
	if houseID != nil {
		sentinelHouseID = *houseID
	}
	lockKey := generateAdvisoryLockKey(sentinelHouseID, user1, user2)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", lockKey); err != nil {
		return 0, fmt.Errorf("failed to acquire advisory lock: %w", err)
	}

	qtx := r.q.WithTx(tx)

	var convID int64
	if houseID != nil {
		id, err := qtx.GetConversationByParticipantsAndHouse(ctx, sqlc.GetConversationByParticipantsAndHouseParams{
			HouseID:  houseID,
			UserID:   user1,
			UserID_2: user2,
		})
		if err == nil {
			convID = id
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return 0, err
		}
	} else {
		id, err := qtx.GetConversationByParticipantsGeneral(ctx, sqlc.GetConversationByParticipantsGeneralParams{
			UserID:   user1,
			UserID_2: user2,
		})
		if err == nil {
			convID = id
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return 0, err
		}
	}

	// If conversation already exists, return its ID
	if convID != 0 {
		_ = tx.Commit(ctx)
		return convID, nil
	}

	// Check if target user is deleted before creating a new conversation
	var isDeleted bool
	err = tx.QueryRow(ctx, "SELECT deleted FROM \"user\" WHERE id = $1", user2).Scan(&isDeleted)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, errors.New("пользователь не найден")
		}
		return 0, err
	}
	if isDeleted {
		return 0, errors.New("профиль пользователя удален")
	}

	// Otherwise, create conversation
	conv, err := qtx.CreateConversation(ctx, houseID)
	if err != nil {
		return 0, fmt.Errorf("failed to create conversation: %w", err)
	}

	// Add participants
	if err := qtx.AddConversationParticipant(ctx, sqlc.AddConversationParticipantParams{
		ConversationID: conv.ID,
		UserID:         user1,
	}); err != nil {
		return 0, fmt.Errorf("failed to add participant 1: %w", err)
	}

	if err := qtx.AddConversationParticipant(ctx, sqlc.AddConversationParticipantParams{
		ConversationID: conv.ID,
		UserID:         user2,
	}); err != nil {
		return 0, fmt.Errorf("failed to add participant 2: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return conv.ID, nil
}

func (r *ChatRepo) CreateMessage(ctx context.Context, convID int64, senderID int32, body *string, attachments []domain.MessageAttachment) (domain.Message, error) {
	type TxBeginner interface {
		Begin(ctx context.Context) (pgx.Tx, error)
	}

	db := r.q.DB()
	txb, ok := db.(TxBeginner)
	if !ok {
		return domain.Message{}, errors.New("underlying database connection does not support transactions")
	}

	tx, err := txb.Begin(ctx)
	if err != nil {
		return domain.Message{}, err
	}
	defer tx.Rollback(ctx)

	qtx := r.q.WithTx(tx)

	// Create message
	msg, err := qtx.CreateMessage(ctx, sqlc.CreateMessageParams{
		ConversationID: convID,
		SenderID:       senderID,
		Body:           body,
	})
	if err != nil {
		return domain.Message{}, err
	}

	// Create attachments if any
	dbAttachments := make([]domain.MessageAttachment, 0, len(attachments))
	for _, att := range attachments {
		var fileName *string
		if att.FileName != "" {
			fileName = &att.FileName
		}
		var mimeType *string
		if att.MimeType != "" {
			mimeType = &att.MimeType
		}
		var sizeBytes *int64
		if att.SizeBytes > 0 {
			sizeBytes = &att.SizeBytes
		}

		row, err := qtx.CreateAttachment(ctx, sqlc.CreateAttachmentParams{
			MessageID: msg.ID,
			Url:       att.URL,
			FileName:  fileName,
			MimeType:  mimeType,
			SizeBytes: sizeBytes,
			Width:     att.Width,
			Height:    att.Height,
		})
		if err != nil {
			return domain.Message{}, fmt.Errorf("failed to save attachment: %w", err)
		}
		dbAttachments = append(dbAttachments, domain.MessageAttachment{
			ID:        row.ID,
			MessageID: row.MessageID,
			URL:       row.Url,
			FileName:  derefString(row.FileName),
			MimeType:  derefString(row.MimeType),
			SizeBytes: derefInt64(row.SizeBytes),
			Width:     row.Width,
			Height:    row.Height,
		})
	}

	// Update sender's last read message ID to the newly sent message
	if err := qtx.UpdateLastReadMessage(ctx, sqlc.UpdateLastReadMessageParams{
		LastReadMessageID: &msg.ID,
		ConversationID:    convID,
		UserID:            senderID,
	}); err != nil {
		return domain.Message{}, err
	}

	// Update conversation updated_at timestamp
	if err := qtx.UpdateConversationTimestamp(ctx, convID); err != nil {
		return domain.Message{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Message{}, err
	}

	return domain.Message{
		ID:             msg.ID,
		ConversationID: msg.ConversationID,
		SenderID:       msg.SenderID,
		Body:           msg.Body,
		CreatedAt:      toTime(msg.CreatedAt),
		Attachments:    dbAttachments,
	}, nil
}

func (r *ChatRepo) ListUserConversations(ctx context.Context, userID int32) ([]domain.ConversationSummary, error) {
	rows, err := r.q.ListUserConversations(ctx, userID)
	if err != nil {
		return nil, err
	}

	summaries := make([]domain.ConversationSummary, 0, len(rows))
	for _, row := range rows {
		summaries = append(summaries, domain.ConversationSummary{
			ConversationID:         row.ConversationID,
			HouseID:                row.HouseID,
			LastActivity:           toTime(row.LastActivity),
			UnreadCount:            row.UnreadCount,
			LastMessageID:          row.LastMessageID,
			LastMessageBody:        row.LastMessageBody,
			LastMessageSenderID:    row.LastMessageSenderID,
			LastMessageCreatedAt:   toTimestamptzPtr(row.LastMessageCreatedAt),
			OtherLastReadMessageID: row.OtherLastReadMessageID,
			OtherUserID:            row.OtherUserID,
			OtherUserName:          derefString(row.OtherUserName),
			OtherUserSurname:       derefString(row.OtherUserSurname),
			OtherUserAvatarUrl:     derefString(row.OtherUserAvatarUrl),
			OtherUserDeleted:       row.OtherUserDeleted,
			HouseStreet:            row.HouseStreet,
			HouseNumber:            row.HouseNumber,
			HouseCountRoom:         row.HouseCountRoom,
			HousePrice:             row.HousePrice,
			HouseCoverPath:         row.HouseCoverPath,
		})
	}

	return summaries, nil
}

func (r *ChatRepo) GetConversationMessages(ctx context.Context, convID int64, cursorMessageID int64, limit int32) ([]domain.Message, error) {
	rows, err := r.q.GetConversationMessages(ctx, sqlc.GetConversationMessagesParams{
		ConversationID: convID,
		Column2:        cursorMessageID,
		Limit:          limit,
	})
	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return []domain.Message{}, nil
	}

	// Fetch attachments for these messages
	msgIDs := make([]int64, len(rows))
	for i, row := range rows {
		msgIDs[i] = row.ID
	}

	attRows, err := r.q.GetMessageAttachments(ctx, msgIDs)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	attMap := make(map[int64][]domain.MessageAttachment)
	for _, att := range attRows {
		attMap[att.MessageID] = append(attMap[att.MessageID], domain.MessageAttachment{
			ID:        att.ID,
			MessageID: att.MessageID,
			URL:       att.Url,
			FileName:  derefString(att.FileName),
			MimeType:  derefString(att.MimeType),
			SizeBytes: derefInt64(att.SizeBytes),
			Width:     att.Width,
			Height:    att.Height,
		})
	}

	messages := make([]domain.Message, len(rows))
	for i, row := range rows {
		messages[i] = domain.Message{
			ID:             row.ID,
			ConversationID: row.ConversationID,
			SenderID:       row.SenderID,
			Body:           row.Body,
			CreatedAt:      toTime(row.CreatedAt),
			Attachments:    attMap[row.ID],
		}
	}

	return messages, nil
}

func (r *ChatRepo) UpdateLastReadMessage(ctx context.Context, messageID int64, convID int64, userID int32) error {
	var msgID *int64
	if messageID > 0 {
		msgID = &messageID
	}
	return r.q.UpdateLastReadMessage(ctx, sqlc.UpdateLastReadMessageParams{
		LastReadMessageID: msgID,
		ConversationID:    convID,
		UserID:            userID,
	})
}

func (r *ChatRepo) CheckParticipantExists(ctx context.Context, convID int64, userID int32) (bool, error) {
	return r.q.CheckParticipantExists(ctx, sqlc.CheckParticipantExistsParams{
		ConversationID: convID,
		UserID:         userID,
	})
}

func (r *ChatRepo) IsOtherParticipantDeleted(ctx context.Context, convID int64, userID int32) (bool, error) {
	return r.q.IsOtherParticipantDeleted(ctx, sqlc.IsOtherParticipantDeletedParams{
		ConversationID: convID,
		UserID:         userID,
	})
}

func (r *ChatRepo) GetOtherParticipantID(ctx context.Context, convID int64, userID int32) (int32, error) {
	return r.q.GetOtherParticipantID(ctx, sqlc.GetOtherParticipantIDParams{
		ConversationID: convID,
		UserID:         userID,
	})
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefInt64(i *int64) int64 {
	if i == nil {
		return 0
	}
	return *i
}

func toTime(t pgtype.Timestamptz) time.Time {
	if t.Valid {
		return t.Time
	}
	return time.Time{}
}

func toTimestamptzPtr(t pgtype.Timestamptz) *time.Time {
	if t.Valid {
		v := t.Time
		return &v
	}
	return nil
}
