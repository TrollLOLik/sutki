import { notificationRepository, type AppNotification, type NotificationScope } from '@features/notifications';
import { sessionEvents, type BookingSessionEvent, type ListingSessionEvent, type ReviewSessionEvent } from '@shared/api';

function addGenerated(item: Omit<AppNotification, 'id' | 'dateLabel' | 'read'>): void {
  const current = notificationRepository.getSnapshot().items;
  notificationRepository.add({
    ...item,
    id: Math.max(0, ...current.map((notification) => notification.id)) + 1,
    dateLabel: 'только что',
    read: false,
  });
}

function bookingNotification(event: BookingSessionEvent): void {
  if (event.source !== 'requests') return;
  const scope: NotificationScope = event.isOwner ? 'incoming' : 'bookings';
  const copy = event.status === 'confirmed'
    ? { action: 'confirmed', title: 'Заявка подтверждена', body: 'Статус бронирования обновлён. Откройте заявку, чтобы посмотреть детали.', tone: 'success' as const }
    : event.status === 'rejected'
      ? { action: 'rejected', title: 'Заявка отклонена', body: event.reason || 'Откройте заявку, чтобы посмотреть причину и доступные действия.', tone: 'danger' as const }
      : event.status === 'cancelled'
        ? { action: 'cancelled', title: 'Заявка отменена', body: 'Изменение уже отражено в истории бронирований.', tone: 'neutral' as const }
        : { action: 'created', title: event.isOwner ? 'Новая заявка на бронирование' : 'Заявка отправлена', body: 'Заявка создана и доступна в разделе бронирований.', tone: 'primary' as const };
  addGenerated({ scope, entityId: event.requestId, ...copy });
}

function listingNotification(event: ListingSessionEvent): void {
  const copy = event.action === 'promoted'
    ? { title: 'Объявление продвигается', body: 'Метка продвижения уже отображается в каталоге.', tone: 'primary' as const }
    : event.action === 'unpublished'
      ? { title: 'Объявление снято с публикации', body: 'Оно осталось в разделе «Мои объявления».', tone: 'neutral' as const }
      : event.action === 'updated'
        ? { title: 'Изменения сохранены', body: 'Карточка объявления обновлена.', tone: 'success' as const }
        : { title: 'Объявление отправлено на модерацию', body: 'Статус можно отслеживать в разделе «Мои объявления».', tone: 'info' as const };
  addGenerated({ scope: 'listings', action: event.action, entityId: event.listingId, ...copy });
}

function reviewNotification(event: ReviewSessionEvent): void {
  const copy = event.action === 'replied'
    ? { action: 'reply_published', title: 'Ответ отправлен', body: 'Ответ появился в карточке отзыва.', tone: 'success' as const }
    : { action: event.action, title: event.action === 'updated' ? 'Отзыв обновлён' : 'Отзыв отправлен', body: 'Отзыв доступен в разделе «Мои отзывы».', tone: 'primary' as const };
  addGenerated({ scope: 'reviews', entityId: event.reviewId, ...copy });
}

export function startDemoEventBridge(): () => void {
  const unsubscribers = [
    sessionEvents.subscribe('booking:status', bookingNotification),
    sessionEvents.subscribe('listing:changed', listingNotification),
    sessionEvents.subscribe('review:changed', reviewNotification),
    sessionEvents.subscribe('session:reset', ({ source }) => {
      if (source !== 'notifications') notificationRepository.reset();
    }),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
