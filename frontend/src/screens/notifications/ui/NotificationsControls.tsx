import { ArrowDown, ArrowUp, MailOpen, type LucideIcon } from 'lucide-react';
import { notificationRepository } from '@features/notifications';
import { PersonalListToolbar } from '@ui';
import { NotificationSummary } from './NotificationSummary';

export type NotificationSort = 'newest' | 'oldest' | 'unread';

const sorts: Array<{ id: NotificationSort; label: string; Icon: LucideIcon }> = [
  { id: 'newest', label: 'Сначала новые', Icon: ArrowDown },
  { id: 'oldest', label: 'Сначала старые', Icon: ArrowUp },
  { id: 'unread', label: 'Сначала непрочитанные', Icon: MailOpen },
];

interface NotificationsControlsProps {
  query: string;
  sort: NotificationSort;
  sortOpen: boolean;
  total: number;
  unread: number;
  onQueryChange: (value: string) => void;
  onSortChange: (value: NotificationSort) => void;
  onSortOpenChange: (open: boolean) => void;
}

export function NotificationsControls(props: NotificationsControlsProps) {
  return (
    <section className="notifications-controls">
      <PersonalListToolbar className="ui-list-search-toolbar notifications-toolbar" query={props.query} onQueryChange={props.onQueryChange} placeholder="Поиск по уведомлениям" sort={props.sort} sortOpen={props.sortOpen} onSortOpenChange={props.onSortOpenChange} onSortChange={props.onSortChange} sortOptions={sorts.map(({id,label,Icon})=>({value:id,label,icon:<Icon size={18}/>}))} />
      {props.total ? <NotificationSummary total={props.total} unread={props.unread} onMarkAllRead={() => notificationRepository.markAllRead()} /> : null}
    </section>
  );
}
