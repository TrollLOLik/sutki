import { Map, MessageCircle, Plus, Search, UserRound } from 'lucide-react';
import { useNotificationsSnapshot } from '@features/notifications';
import { useChatSnapshot } from '@features/chat';
import { Pressable } from '@ui';

const tabs = [
  { id: 'search', label: 'Поиск', Icon: Search },
  { id: 'map', label: 'Карта', Icon: Map },
  { id: 'create', label: 'Разместить', Icon: Plus },
  { id: 'messages', label: 'Сообщения', Icon: MessageCircle },
  { id: 'profile', label: 'Профиль', Icon: UserRound },
] as const;

export function CustomTabBar({ active, hidden, mapLayout = false, onChange }: { active: string; hidden: boolean; mapLayout?: boolean; onChange: (value: string) => void }) {
  const { unread } = useNotificationsSnapshot();
  const { conversations } = useChatSnapshot();
  const unreadMessages = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  return (
    <nav className={`custom-tab-bar ${mapLayout ? 'is-map-layout' : ''} ${hidden ? 'is-hidden' : ''}`} aria-label="Основная навигация" aria-hidden={hidden || undefined}>
      <div className="tab-bar-material">
        {tabs.map(({ id, label, Icon }) => {
          if (id === 'create') {
            return (
              <Pressable key={id} className="create-tab" aria-label={label} tabIndex={hidden ? -1 : 0} onClick={() => onChange(id)}>
                <span className="create-pulse" />
                <span className="create-gradient"><span className="create-shimmer" /><Icon size={28} /></span>
              </Pressable>
            );
          }

          const accessibleLabel = id === 'messages' && unreadMessages > 0
            ? `${label}, ${unreadMessages} непрочитанных сообщений`
            : id === 'profile' && unread > 0
              ? `${label}, ${unread} непрочитанных уведомлений`
              : label;
          return (
            <Pressable key={id} className={`tab-button ${active === id ? 'active' : ''}`} aria-label={accessibleLabel} aria-current={active === id ? 'page' : undefined} tabIndex={hidden ? -1 : 0} onClick={() => { if (active !== id) onChange(id); }}>
              <span className="tab-icon"><Icon size={24} fill={active === id ? 'currentColor' : 'none'} />{id === 'messages' && unreadMessages > 0 ? <i className="tab-notification-badge" aria-hidden="true">{unreadMessages > 99 ? '99+' : unreadMessages}</i> : null}{id === 'profile' && unread > 0 ? <i className="tab-notification-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</i> : null}</span>
            </Pressable>
          );
        })}
      </div>
    </nav>
  );
}
