import type { ChatMessage, Conversation } from '@features/chat';

export function timestampOf(conversation: Conversation): number {
  const last = conversation.messages[conversation.messages.length - 1];
  return last ? new Date(last.createdAt).getTime() : 0;
}

export function latestMessage(conversation: Conversation): ChatMessage | undefined {
  return conversation.messages[conversation.messages.length - 1];
}

export function latestMessagePreview(message?: ChatMessage): string {
  if (!message) return 'Начните переписку';
  if (message.deletedAt) return 'Сообщение удалено';
  if (message.kind === 'booking_status') {
    const event = message.booking?.event;
    if (event === 'confirmed') return 'Бронирование подтверждено';
    if (event === 'rejected') return 'Заявка отклонена';
    if (event === 'cancelled') return 'Заявка отменена гостем';
    return 'Новая заявка на бронирование';
  }
  if (message.kind === 'system') return message.body || 'Системное сообщение';
  if (message.body) return message.body;
  if (message.attachments?.some((item) => item.kind === 'image')) return 'Фотография';
  if (message.attachments?.some((item) => item.kind === 'video')) return 'Видео';
  if (message.attachments?.length) return 'Вложение';
  return 'Сообщение';
}

export function relativeListTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  const diff = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diff < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function roomsLabel(rooms: number): string {
  if (rooms === 0) return 'Студия';
  if (rooms === 1) return '1-комнатная';
  return `${rooms}-комнатная`;
}

export function formatDay(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatLastSeen(value?: string): string {
  if (!value) return 'Не в сети';
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `был(а) сегодня в ${formatTime(value)}`;
  return `был(а) ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
}

export function formatBookingRange(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const startText = startDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
  const endText = endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
  return `${startText} — ${endText}`;
}

export function guestsLabel(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value} гость`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} гостя`;
  return `${value} гостей`;
}
