package chat

import (
	"context"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type imageChatRepo struct {
	domain.ChatRepository
	created     bool
	attachments []domain.MessageAttachment
}

func (r *imageChatRepo) CheckParticipantExists(context.Context, int64, int32) (bool, error) {
	return true, nil
}

func (r *imageChatRepo) IsOtherParticipantDeleted(context.Context, int64, int32) (bool, error) {
	return false, nil
}

func (r *imageChatRepo) CreateMessage(_ context.Context, convID int64, senderID int32, _ *string, _ *int64, attachments []domain.MessageAttachment) (domain.Message, error) {
	r.created = true
	r.attachments = append([]domain.MessageAttachment(nil), attachments...)
	for i := range attachments {
		attachments[i].ID = int64(i + 1)
		attachments[i].MessageID = 41
	}
	return domain.Message{
		ID:             41,
		ConversationID: convID,
		SenderID:       &senderID,
		Attachments:    attachments,
		CreatedAt:      time.Now(),
	}, nil
}

type imageChatStorage struct {
	domain.FileStorage
	deleted []string
}

func (s *imageChatStorage) StatObject(context.Context, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{SizeBytes: 100, ContentType: "image/jpeg"}, nil
}

func (s *imageChatStorage) PresignGet(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://storage.example/" + key, nil
}

func (s *imageChatStorage) Delete(_ context.Context, key string) error {
	s.deleted = append(s.deleted, key)
	return nil
}

type recordingAttachmentQueue struct {
	jobs []domain.AttachmentModerationJob
}

func (q *recordingAttachmentQueue) Enqueue(_ context.Context, job domain.AttachmentModerationJob) error {
	q.jobs = append(q.jobs, job)
	return nil
}

func TestSendMessageQueuesImageModerationAfterPersisting(t *testing.T) {
	repo := &imageChatRepo{}
	storage := &imageChatStorage{}
	queue := &recordingAttachmentQueue{}
	service := New(repo, storage, Config{})
	service.SetAttachmentModerationQueue(queue, nil)
	// Owner-scoped, and scoped to the sender below: since MEDIA-02 a key that
	// names no owner (or someone else's) is refused before it is ever stated.
	const senderID int32 = 7
	key := attachmentKey(senderID, "0123456789abcdef0123456789abcdef", ".jpg")

	_, err := service.SendMessage(context.Background(), senderID, 11, nil, nil, []domain.MessageAttachment{{URL: key}})
	if err != nil {
		t.Fatalf("send message: %v", err)
	}
	if !repo.created {
		t.Fatal("message was not persisted")
	}
	if len(repo.attachments) != 1 || repo.attachments[0].ModerationStatus != domain.AttachmentModerationPending {
		t.Fatalf("persisted attachments=%+v", repo.attachments)
	}
	if len(queue.jobs) != 1 {
		t.Fatalf("queued jobs=%+v", queue.jobs)
	}
	if queue.jobs[0].ObjectKey != key || queue.jobs[0].Kind != domain.AttachmentKindImage {
		t.Fatalf("queued job=%+v", queue.jobs[0])
	}
}
