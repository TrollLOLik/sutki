import { Bell, Search } from 'lucide-react';
import type { AppNotification } from '@features/notifications';
import { DescriptionText, EmptyState, SectionTitle } from '@ui';
import { NotificationRow } from './NotificationRow';

interface NotificationsResultsProps {
  total: number;
  items: AppNotification[];
  onOpen: (item: AppNotification) => void;
}

export function NotificationsResults({ total, items, onOpen }: NotificationsResultsProps) {
  if (!total) return <EmptyState icon={<Bell size={38} />} title="Уведомлений пока нет" description="Здесь появятся сообщения о заявках, объявлениях, чатах и отзывах." />;
  if (!items.length) return <EmptyState icon={<Search size={38} />} title="Ничего не найдено" description="Попробуйте изменить поисковый запрос." />;
  return <section className="notifications-list"><header><SectionTitle as="h2">Последние события</SectionTitle><DescriptionText>{items.length}</DescriptionText></header>{items.map((item) => <NotificationRow key={item.id} item={item} onOpen={() => onOpen(item)} />)}</section>;
}
