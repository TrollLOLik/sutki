import { MessagesSquare } from 'lucide-react';
import { useLayoutEffect } from 'react';
import { DesktopTopbar } from '@widgets/app-navigation';
import { EmptyState } from '@ui';

export function GuestMessagesPage({ onHome, onCreate, onMap, onProfile, onAuth, onTabBarHiddenChange }: {
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onProfile: () => void;
  onAuth: () => void;
  onTabBarHiddenChange: (hidden: boolean) => void;
}) {
  useLayoutEffect(() => onTabBarHiddenChange(false), [onTabBarHiddenChange]);

  return (
    <div className="chat-page guest-messages-page">
      <DesktopTopbar active="messages" onSearch={onHome} onMap={onMap} onMessages={() => undefined} onProfile={onProfile} onCreate={onCreate} />
      <main className="guest-messages-content"><EmptyState className="guest-messages-empty" icon={<MessagesSquare size={39} />} title="Сообщения" description="Войдите в аккаунт, чтобы общаться с владельцами жилья и обсуждать детали бронирования." actionLabel="Войти в профиль" onAction={onAuth} /></main>
    </div>
  );
}
