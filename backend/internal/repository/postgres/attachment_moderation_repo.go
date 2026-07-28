package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
)

// AttachmentModerationRepo persists the chat attachment moderation queue.
//
// Kept apart from ChatRepo because it is consumed by the background worker, not
// by request handlers: the worker only ever needs these eight statements, and a
// narrow interface makes it obvious that it cannot touch messages directly.
type AttachmentModerationRepo struct {
	q *sqlc.Queries
}

func NewAttachmentModerationRepo(q *sqlc.Queries) *AttachmentModerationRepo {
	return &AttachmentModerationRepo{q: q}
}

// Enqueue schedules an attachment check. Idempotent: re-queuing the same
// attachment is a no-op.
func (r *AttachmentModerationRepo) Enqueue(ctx context.Context, job domain.AttachmentModerationJob) error {
	return r.q.EnqueueAttachmentModeration(ctx, sqlc.EnqueueAttachmentModerationParams{
		AttachmentID:   job.AttachmentID,
		MessageID:      job.MessageID,
		ConversationID: job.ConversationID,
		ObjectKey:      job.ObjectKey,
		MimeType:       job.MimeType,
		Kind:           job.Kind,
	})
}

// ReleaseStaleAttachmentJobs returns jobs whose worker died back to the queue.
func (r *AttachmentModerationRepo) ReleaseStaleAttachmentJobs(ctx context.Context, lease time.Duration) error {
	return r.q.ReleaseStaleAttachmentJobs(ctx, durationToInterval(lease))
}

// ClaimAttachmentModerationJobs takes up to batchSize due jobs, marking them
// processing. Safe with several workers thanks to FOR UPDATE SKIP LOCKED.
func (r *AttachmentModerationRepo) ClaimAttachmentModerationJobs(ctx context.Context, batchSize int32) ([]domain.AttachmentModerationJob, error) {
	rows, err := r.q.ClaimAttachmentModerationJobs(ctx, batchSize)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	out := make([]domain.AttachmentModerationJob, 0, len(rows))
	for _, row := range rows {
		out = append(out, domain.AttachmentModerationJob{
			ID:             row.ID,
			AttachmentID:   row.AttachmentID,
			MessageID:      row.MessageID,
			ConversationID: row.ConversationID,
			ObjectKey:      row.ObjectKey,
			MimeType:       row.MimeType,
			Kind:           row.Kind,
			Attempts:       row.Attempts,
		})
	}
	return out, nil
}

func (r *AttachmentModerationRepo) CompleteAttachmentModeration(ctx context.Context, jobID int64, decision, category, reason string, confidence float32, framesChecked int32) error {
	return r.q.CompleteAttachmentModeration(ctx, sqlc.CompleteAttachmentModerationParams{
		Decision:      strPtrOrNil(decision),
		Category:      strPtrOrNil(category),
		Reason:        strPtrOrNil(reason),
		Confidence:    &confidence,
		FramesChecked: &framesChecked,
		JobID:         jobID,
	})
}

func (r *AttachmentModerationRepo) RetryAttachmentModeration(ctx context.Context, jobID int64, nextAttemptAt time.Time, lastError string) error {
	return r.q.RetryAttachmentModeration(ctx, sqlc.RetryAttachmentModerationParams{
		NextAttemptAt: pgtype.Timestamptz{Time: nextAttemptAt, Valid: true},
		LastError:     strPtrOrNil(lastError),
		JobID:         jobID,
	})
}

func (r *AttachmentModerationRepo) SetAttachmentModerationStatus(ctx context.Context, attachmentID int64, status string) error {
	return r.q.SetAttachmentModerationStatus(ctx, sqlc.SetAttachmentModerationStatusParams{
		ModerationStatus: status,
		AttachmentID:     attachmentID,
	})
}

func (r *AttachmentModerationRepo) SetAttachmentVideoMeta(ctx context.Context, attachmentID int64, durationSeconds *int32, thumbnailURL string) error {
	return r.q.SetAttachmentVideoMeta(ctx, sqlc.SetAttachmentVideoMetaParams{
		DurationSeconds: durationSeconds,
		ThumbnailUrl:    strPtrOrNil(thumbnailURL),
		AttachmentID:    attachmentID,
	})
}

// RejectAttachment records the verdict and replaces the attachment with a
// sender-only tombstone in one transaction. Object keys are returned only when
// no other durable reference remains.
func (r *AttachmentModerationRepo) RejectAttachment(
	ctx context.Context,
	jobID, attachmentID int64,
	category, reason string,
	confidence float32,
	framesChecked int32,
) ([]string, error) {
	type TxBeginner interface {
		Begin(ctx context.Context) (pgx.Tx, error)
	}

	txb, ok := r.q.DB().(TxBeginner)
	if !ok {
		return nil, errors.New("underlying database connection does not support transactions")
	}

	tx, err := txb.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	qtx := r.q.WithTx(tx)
	if err := qtx.CompleteAttachmentModeration(ctx, sqlc.CompleteAttachmentModerationParams{
		Decision:      strPtrOrNil(string(domain.ImageModerationReject)),
		Category:      strPtrOrNil(category),
		Reason:        strPtrOrNil(reason),
		Confidence:    &confidence,
		FramesChecked: &framesChecked,
		JobID:         jobID,
	}); err != nil {
		return nil, err
	}

	objectKey, err := qtx.LockAttachmentUpload(ctx, attachmentID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		objectKey = ""
	}

	if err := qtx.RejectAttachment(ctx, sqlc.RejectAttachmentParams{
		ModerationReason: reason,
		AttachmentID:     attachmentID,
	}); err != nil {
		return nil, err
	}

	var orphanedKeys []string
	if objectKey != "" {
		rows, err := qtx.DeleteOrphanedChatUploads(ctx, []string{objectKey})
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			orphanedKeys = append(orphanedKeys, row.ObjectKey)
			if row.SealedKey != nil && *row.SealedKey != "" {
				orphanedKeys = append(orphanedKeys, *row.SealedKey)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return orphanedKeys, nil
}

func (r *AttachmentModerationRepo) CountPendingAttachments(ctx context.Context, messageID int64) (int64, error) {
	return r.q.CountPendingAttachments(ctx, messageID)
}

// strPtrOrNil maps an empty string to SQL NULL, keeping "unset" and "empty
// string" distinguishable in the audit columns.
func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
