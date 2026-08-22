import { Bell, CheckCheck } from 'lucide-react';
import { BodyText, DescriptionText, IconButton } from '@ui';

interface NotificationSummaryProps {
  total: number;
  unread: number;
  onMarkAllRead: () => void;
}

export function NotificationSummary({ total, unread, onMarkAllRead }: NotificationSummaryProps) {
  const allRead = unread === 0;
  return <article className="notifications-summary"><span className={allRead ? 'success' : ''}>{allRead ? <CheckCheck size={24} /> : <Bell size={24} />}</span><div><BodyText as="strong" weight={500}>{allRead ? 'Всё просмотрено' : unreadLabel(unread)}</BodyText><DescriptionText as="p">{allRead ? `${eventsLabel(total)} в центре уведомлений` : 'Важные изменения собраны в одном месте'}</DescriptionText></div><IconButton className={allRead ? 'is-complete' : undefined} label="Прочитать все уведомления" size="sm" mode="solid" tone="primary" aria-hidden={allRead || undefined} disabled={allRead} icon={<CheckCheck size={21} />} onClick={onMarkAllRead} /></article>;
}

function unreadLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} непрочитанных`;
  if (last === 1) return `${count} непрочитанное`;
  if (last >= 2 && last <= 4) return `${count} непрочитанных`;
  return `${count} непрочитанных`;
}

function eventsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} событий`;
  if (last === 1) return `${count} событие`;
  if (last >= 2 && last <= 4) return `${count} события`;
  return `${count} событий`;
}
