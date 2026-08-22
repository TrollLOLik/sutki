import type { ChatMessage } from './types';

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 60 * 60 * 1000;

export interface MessageActionsAvailability {
  canReply: boolean;
  canCopy: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function getMessageActions(
  message: ChatMessage,
  now = Date.now(),
): MessageActionsAvailability {
  const isUserMessage = message.kind === 'user';
  const isDeleted = Boolean(message.deletedAt);
  const isSettled = message.delivery !== 'pending' && message.delivery !== 'failed';
  const isMine = message.senderId === 'me';
  const hasText = Boolean(message.body?.trim());
  const hasAttachments = Boolean(message.attachments?.length);
  const age = now - new Date(message.createdAt).getTime();
  const isReadByOther = message.delivery === 'read';

  return {
    canReply: isUserMessage && !isDeleted && isSettled,
    canCopy: hasText && !isDeleted,
    canEdit: isMine
      && isUserMessage
      && !isDeleted
      && isSettled
      && hasText
      && !hasAttachments
      && !isReadByOther
      && age < EDIT_WINDOW_MS,
    canDelete: isMine
      && isUserMessage
      && !isDeleted
      && isSettled
      && age < DELETE_WINDOW_MS,
  };
}

export function getMessageActionHint(message: ChatMessage, now = Date.now()): string | null {
  if (message.senderId !== 'me' || message.kind !== 'user' || message.deletedAt) return null;

  const age = now - new Date(message.createdAt).getTime();
  if (age >= DELETE_WINDOW_MS) {
    return 'Изменить или удалить сообщение можно только в первый час после отправки.';
  }
  if (message.delivery === 'read') {
    return 'Прочитанное сообщение уже нельзя изменить.';
  }
  if (message.attachments?.length) {
    return 'Вложения нельзя изменить после отправки.';
  }
  return null;
}