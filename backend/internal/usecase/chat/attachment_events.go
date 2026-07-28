package chat

import (
	"context"
	"fmt"
	"log"
)

// This file implements the attachmentmoderation.Notifier port: the two things
// the background worker needs the chat service to do once a verdict exists.
//
// The worker deliberately does not publish to Centrifugo itself — channel
// naming, presigning and recipient lookup all live here, and duplicating them in
// the worker would be two places to keep in sync.

// AttachmentApproved delivers a message whose attachments have all passed.
//
// This is the deferred half of publishMessage: while anything was pending the
// broadcast was suppressed so the recipient would not receive unverified media.
// Now the message is published exactly as a normal new message, so clients need
// no special handling — it simply arrives a few seconds later than the text-only
// case.
func (s *Service) AttachmentApproved(ctx context.Context, conversationID, messageID int64) {
	msg, err := s.repo.GetMessageByID(ctx, messageID)
	if err != nil {
		log.Printf("[Chat] Approved attachment: load message %d: %v", messageID, err)
		return
	}
	// Deleted while its media was being checked: nothing to deliver.
	if msg.DeletedAt != nil {
		return
	}

	publicMsg, deliverable := messageForRecipient(msg)
	if !deliverable {
		return
	}
	for i := range publicMsg.Attachments {
		publicMsg.Attachments[i] = s.presignAttachment(ctx, publicMsg.Attachments[i])
	}
	s.hydrateAndPresignQuote(ctx, &publicMsg)

	s.publishMessage(ctx, publicMsg)

	// The recipient was never notified at send time (the message was invisible to
	// them), so the email / notification-centre path runs now. Same function
	// SendMessage uses, on a detached context because the worker's context may be
	// cancelled as soon as the job finishes.
	if s.notifier != nil || s.userEvents != nil {
		go s.notifyRecipient(context.WithoutCancel(ctx), publicMsg)
	}
	s.publishAttachmentChanged(conversationID, messageID)
}

// AttachmentRejected tells the sender their upload was dropped.
//
// Sent only to the sender's personal channel: the recipient never saw the
// attachment, and telling them that something was rejected would leak what the
// other party tried to send.
func (s *Service) AttachmentRejected(ctx context.Context, conversationID, messageID int64, reason string) {
	msg, err := s.repo.GetMessageByID(ctx, messageID)
	if err != nil {
		log.Printf("[Chat] Rejected attachment: load message %d: %v", messageID, err)
		return
	}
	if msg.SenderID == nil {
		return
	}

	if reason == "" {
		reason = "вложение не прошло проверку"
	}

	_ = s.centrifugoPublish(fmt.Sprintf("user:#%d", *msg.SenderID), map[string]any{
		"type":            "attachment.rejected",
		"conversation_id": conversationID,
		"message_id":      messageID,
		"reason":          reason,
	})

	// Also fires on the conversation channel so an open chat updates in place
	// instead of waiting for a refetch. Both participants receive it, but the
	// payload carries no content — only that this message lost an attachment.
	if publicMsg, deliverable := messageForRecipient(msg); deliverable {
		for i := range publicMsg.Attachments {
			publicMsg.Attachments[i] = s.presignAttachment(ctx, publicMsg.Attachments[i])
		}
		s.hydrateAndPresignQuote(ctx, &publicMsg)
		s.publishMessage(ctx, publicMsg)
		if s.notifier != nil || s.userEvents != nil {
			go s.notifyRecipient(context.WithoutCancel(ctx), publicMsg)
		}
	}

	s.publishAttachmentChanged(conversationID, messageID)
}

func (s *Service) publishAttachmentChanged(conversationID, messageID int64) {
	_ = s.centrifugoPublish(fmt.Sprintf("chat:conv_%d", conversationID), map[string]any{
		"type":       "message.attachment_changed",
		"message_id": messageID,
	})
}
