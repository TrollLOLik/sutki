import { useSyncExternalStore } from 'react';

export type NotificationScope = 'messages' | 'incoming' | 'bookings' | 'listings' | 'reviews';
export type NotificationTone = 'primary' | 'info' | 'success' | 'danger' | 'neutral';

export interface AppNotification {
  id: number;
  scope: NotificationScope;
  action: string;
  entityId?: number;
  title: string;
  body: string;
  dateLabel: string;
  tone: NotificationTone;
  read: boolean;
}

export interface NotificationsSnapshot { items: AppNotification[]; unread: number; }

const STORAGE_KEY = 'vigazh-notifications-v5';
const scopes: NotificationScope[] = ['messages', 'incoming', 'bookings', 'listings', 'reviews'];
const tones: NotificationTone[] = ['primary', 'info', 'success', 'danger', 'neutral'];
const seed: AppNotification[] = [
  { id: 6, scope: 'messages', action: 'created', entityId: 101, title: 'Новое сообщение от Анны', body: 'Здравствуйте! Подскажите, квартира свободна на выбранные даты?', dateLabel: '5 минут назад', tone: 'info', read: false },
  { id: 5, scope: 'incoming', action: 'created', entityId: 8401, title: 'Новая заявка на бронирование', body: 'Проверьте даты, количество гостей и подтвердите доступность жилья.', dateLabel: '28 минут назад', tone: 'primary', read: false },
  { id: 4, scope: 'bookings', action: 'confirmed', entityId: 9202, title: 'Ваша заявка подтверждена', body: 'Владелец подтвердил проживание. Откройте заявку, чтобы посмотреть подробности.', dateLabel: '2 часа назад', tone: 'success', read: false },
  { id: 3, scope: 'listings', action: 'active', entityId: 1, title: 'Объявление опубликовано', body: 'Оно прошло проверку и теперь доступно гостям в поиске.', dateLabel: 'вчера', tone: 'success', read: true },
  { id: 2, scope: 'reviews', action: 'received', title: 'Вам оставили отзыв', body: 'Новый отзыв опубликован в вашем профиле.', dateLabel: '2 дня назад', tone: 'primary', read: true },
  { id: 1, scope: 'reviews', action: 'rejected', title: 'Отзыв не прошёл проверку', body: 'Исправьте текст отзыва и отправьте его на проверку повторно.', dateLabel: '5 дней назад', tone: 'danger', read: true },
  { id: 12, scope: 'incoming', action: 'created', entityId: 8402, title: 'Гость уточнил детали', body: 'В заявке появился новый комментарий о времени заселения.', dateLabel: '6 дней назад', tone: 'info', read: true },
  { id: 11, scope: 'bookings', action: 'confirmed', entityId: 9201, title: 'Даты проживания подтверждены', body: 'Бронирование сохранено. Контакты владельца доступны в деталях.', dateLabel: '7 дней назад', tone: 'success', read: true },
  { id: 10, scope: 'listings', action: 'active', entityId: 3, title: 'Объявление снова в поиске', body: 'Карточка доступна гостям и участвует в результатах поиска.', dateLabel: '8 дней назад', tone: 'success', read: true },
  { id: 9, scope: 'messages', action: 'created', entityId: 103, title: 'Новое сообщение в чате', body: 'Владелец ответил на вопрос о времени заезда.', dateLabel: '9 дней назад', tone: 'info', read: true },
  { id: 8, scope: 'incoming', action: 'rejected', entityId: 8395, title: 'Заявка отклонена', body: 'Причина сохранена в истории входящих заявок.', dateLabel: '10 дней назад', tone: 'danger', read: true },
  { id: 7, scope: 'bookings', action: 'cancelled', entityId: 9204, title: 'Бронирование отменено', body: 'Отменённая заявка осталась в истории бронирований.', dateLabel: '11 дней назад', tone: 'neutral', read: true },
];

function readStored(): AppNotification[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return seed;
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return seed;
    const stored = parsed.filter(isNotification);
    const storedIds = new Set(stored.map((item) => item.id));
    return [...stored, ...seed.filter((item) => !storedIds.has(item.id))];
  } catch { return seed; }
}

function isNotification(value: unknown): value is AppNotification {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AppNotification>;
  return typeof item.id === 'number'
    && typeof item.title === 'string'
    && typeof item.body === 'string'
    && typeof item.action === 'string'
    && typeof item.dateLabel === 'string'
    && typeof item.read === 'boolean'
    && scopes.includes(item.scope as NotificationScope)
    && tones.includes(item.tone as NotificationTone)
    && (item.entityId === undefined || typeof item.entityId === 'number');
}

let items = readStored();
let snapshot = makeSnapshot(items);
const listeners = new Set<() => void>();

function makeSnapshot(next: AppNotification[]): NotificationsSnapshot {
  return { items: next, unread: next.filter((item) => !item.read).length };
}

function commit(next: AppNotification[]) {
  items = next;
  snapshot = makeSnapshot(items);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* Keep state in memory. */ }
  listeners.forEach((listener) => listener());
}

export const notificationRepository = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot() { return snapshot; },
  markRead(id: number) { commit(items.map((item) => item.id === id ? { ...item, read: true } : item)); },
  markAllRead() { commit(items.map((item) => item.read ? item : { ...item, read: true })); },
  add(item: AppNotification) { commit([item, ...items.filter((current) => current.id !== item.id)]); },
  reset() { commit(seed); },
};

export function useNotificationsSnapshot() {
  return useSyncExternalStore(notificationRepository.subscribe, notificationRepository.getSnapshot, notificationRepository.getSnapshot);
}
