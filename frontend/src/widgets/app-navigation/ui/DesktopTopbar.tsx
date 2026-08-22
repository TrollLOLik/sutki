import { Home, Map, MessageCircle, Search, UserRound } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cx } from '@shared/lib/cx';
import { BodyText, Button, Pressable } from '@ui';

export type DesktopNavigationItem = 'search' | 'map' | 'messages' | 'profile';

export interface DesktopTopbarProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  active?: DesktopNavigationItem;
  innerClassName?: string;
  onSearch: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onCreate: () => void;
}

const items = [
  { id: 'search', label: 'Поиск', Icon: Search },
  { id: 'map', label: 'Карта', Icon: Map },
  { id: 'messages', label: 'Сообщения', Icon: MessageCircle },
  { id: 'profile', label: 'Профиль', Icon: UserRound },
] as const;

export function DesktopTopbar({
  active,
  innerClassName,
  onSearch,
  onMap,
  onMessages,
  onProfile,
  onCreate,
  className,
  ...props
}: DesktopTopbarProps) {
  const handlers: Record<DesktopNavigationItem, () => void> = {
    search: onSearch,
    map: onMap,
    messages: onMessages,
    profile: onProfile,
  };

  return (
    <header {...props} className={cx('desktop-topbar', className)}>
      <div className={cx('desktop-topbar-inner', innerClassName)}>
        <Pressable className="desktop-brand" onClick={onSearch}>
          <span className="desktop-brand-mark"><Home size={21} /></span>
          <BodyText className="ui-text--inherit-metrics" color="inherit" weight={500}>ВИГАЖ</BodyText>
        </Pressable>
        <nav className="desktop-navigation" aria-label="Основная навигация">
          {items.map(({ id, label, Icon }) => (
            <Pressable
              key={id}
              className={active === id ? 'active' : undefined}
              aria-current={active === id ? 'page' : undefined}
              onClick={handlers[id]}
            >
              <Icon size={18} fill={id === 'profile' && active === id ? 'currentColor' : 'none'} />
              <BodyText className="ui-text--inherit-metrics" color="inherit" weight={500}>{label}</BodyText>
            </Pressable>
          ))}
        </nav>
        <Button className="desktop-create-button" size="md" aria-label="Разместить объявление" title="Разместить объявление" onClick={onCreate}>
          <BodyText className="desktop-create-label ui-text--inherit-metrics" color="inherit" weight={500}>Разместить</BodyText>
        </Button>
      </div>
    </header>
  );
}
