package chat

import (
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestRejectedOnlyMessageIsHiddenFromSender(t *testing.T) {
	senderID := int32(7)
	msg := domain.Message{
		SenderID: &senderID,
		Attachments: []domain.MessageAttachment{{
			ID:               10,
			ModerationStatus: domain.AttachmentModerationRejected,
			ModerationReason: "Недопустимый контент",
		}},
	}

	if messageVisibleToViewer(msg, senderID) {
		t.Fatal("policy rejection must be explained by modal, not kept as a chat bubble")
	}
	if got := visibleAttachments(msg, senderID); len(got) != 0 {
		t.Fatalf("rejected attachment must stay out of sender history, got %#v", got)
	}
}

func TestRejectedOnlyMessageIsHiddenFromRecipient(t *testing.T) {
	senderID := int32(7)
	msg := domain.Message{
		SenderID: &senderID,
		Attachments: []domain.MessageAttachment{{
			ID:               10,
			ModerationStatus: domain.AttachmentModerationRejected,
		}},
	}

	if messageVisibleToViewer(msg, 8) {
		t.Fatal("recipient must not receive a message whose media was fully rejected")
	}
	if _, ok := messageForRecipient(msg); ok {
		t.Fatal("rejected-only message must not be published")
	}
}

func TestMixedAlbumPublishesOnlyApprovedAttachments(t *testing.T) {
	senderID := int32(7)
	msg := domain.Message{
		SenderID: &senderID,
		Attachments: []domain.MessageAttachment{
			{ID: 10, ModerationStatus: domain.AttachmentModerationRejected},
			{ID: 11, ModerationStatus: domain.AttachmentModerationApproved},
		},
	}

	publicMsg, ok := messageForRecipient(msg)
	if !ok {
		t.Fatal("mixed album with safe media should be deliverable")
	}
	if len(publicMsg.Attachments) != 1 || publicMsg.Attachments[0].ID != 11 {
		t.Fatalf("expected only approved attachment, got %#v", publicMsg.Attachments)
	}
	if got := visibleAttachments(msg, senderID); len(got) != 1 || got[0].ID != 11 {
		t.Fatalf("sender history must omit rejected album items, got %#v", got)
	}
}

func TestPendingAlbumIsHiddenFromRecipient(t *testing.T) {
	senderID := int32(7)
	msg := domain.Message{
		SenderID: &senderID,
		Attachments: []domain.MessageAttachment{
			{ID: 10, ModerationStatus: domain.AttachmentModerationApproved},
			{ID: 11, ModerationStatus: domain.AttachmentModerationPending},
		},
	}

	if messageVisibleToViewer(msg, 8) {
		t.Fatal("recipient must wait until every attachment has a verdict")
	}
	if _, ok := messageForRecipient(msg); ok {
		t.Fatal("pending album must not be published")
	}
}

func TestFailedAttachmentStaysVisibleToSenderAndHiddenFromRecipient(t *testing.T) {
	senderID := int32(7)
	msg := domain.Message{
		SenderID: &senderID,
		Attachments: []domain.MessageAttachment{{
			ID:               10,
			ModerationStatus: domain.AttachmentModerationFailed,
			ModerationReason: "Сервис проверки временно недоступен.",
		}},
	}

	if !messageVisibleToViewer(msg, senderID) {
		t.Fatal("sender must see a retryable failed attachment")
	}
	if got := visibleAttachments(msg, senderID); len(got) != 1 {
		t.Fatalf("sender must receive the failed attachment, got %#v", got)
	}
	if messageVisibleToViewer(msg, 8) {
		t.Fatal("recipient must not see an unverified failed attachment")
	}
	if _, ok := messageForRecipient(msg); ok {
		t.Fatal("failed attachment must not be published")
	}
}

func TestFailedAlbumBlocksAlreadyApprovedSiblings(t *testing.T) {
	senderID := int32(7)
	msg := domain.Message{
		SenderID: &senderID,
		Attachments: []domain.MessageAttachment{
			{ID: 10, ModerationStatus: domain.AttachmentModerationApproved},
			{ID: 11, ModerationStatus: domain.AttachmentModerationFailed},
		},
	}

	if messageVisibleToViewer(msg, 8) {
		t.Fatal("recipient must wait while any album attachment awaits manual retry")
	}
	if _, ok := messageForRecipient(msg); ok {
		t.Fatal("approved siblings must not leak before the failed attachment is resolved")
	}
}
