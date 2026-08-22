import { useMemo, useState } from 'react';
import { notificationRepository, useNotificationsSnapshot, type AppNotification } from '@features/notifications';
import { DesktopTopbar } from '@widgets/app-navigation';
import { ListPageHeader } from '@ui';
import { NotificationsControls, type NotificationSort } from './NotificationsControls';
import { NotificationsResults } from './NotificationsResults';
import '../notifications.css';

export interface NotificationsPageProps {
  onBack: () => void;
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onOpen: (notification: AppNotification) => void;
}


export function NotificationsPage(props: NotificationsPageProps) {
  const { items: allItems, unread } = useNotificationsSnapshot();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<NotificationSort>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const items = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    return [...allItems]
      .filter((item) => !needle || `${item.title} ${item.body}`.toLocaleLowerCase('ru').includes(needle))
      .sort((a, b) => sort === 'oldest' ? a.id - b.id : sort === 'unread' ? Number(a.read) - Number(b.read) || b.id - a.id : b.id - a.id);
  }, [allItems, query, sort]);
  const open = (item: AppNotification) => {
    if (!item.read) notificationRepository.markRead(item.id);
    props.onOpen(item);
  };

  return (
    <div className="notifications-page">
      <DesktopTopbar active="profile" onSearch={props.onHome} onMap={props.onMap} onMessages={props.onMessages} onProfile={props.onProfile} onCreate={props.onCreate} />
      <ListPageHeader presentation="mobile" className="notifications-mobile-header" title="Уведомления" onBack={props.onBack} />
      <main className="notifications-main">
        <ListPageHeader presentation="desktop" className="notifications-desktop-heading" title="Уведомления" onBack={props.onBack} />
        <NotificationsControls query={query} sort={sort} sortOpen={sortOpen} total={allItems.length} unread={unread} onQueryChange={setQuery} onSortChange={setSort} onSortOpenChange={setSortOpen} />
        <NotificationsResults total={allItems.length} items={items} onOpen={open} />
      </main>
    </div>
  );
}
