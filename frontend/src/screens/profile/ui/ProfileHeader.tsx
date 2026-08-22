import { Settings } from 'lucide-react';
import { Button, IconButton, ListPageHeader } from '@ui';

interface ProfileHeaderProps {
  presentation: 'mobile' | 'desktop';
  onBack: () => void;
  onSettings?: () => void;
}

export function ProfileHeader({ presentation, onBack, onSettings }: ProfileHeaderProps) {
  const actions = onSettings
    ? presentation === 'mobile'
      ? <IconButton label="Настройки профиля" mode="soft" tone="neutral" icon={<Settings size={20} />} onClick={onSettings} />
      : <Button size="sm" mode="soft" tone="neutral" startIcon={<Settings size={17} />} onClick={onSettings}>Настройки</Button>
    : undefined;

  return (
    <ListPageHeader
      presentation={presentation}
      className={presentation === 'mobile' ? 'profile-mobile-header' : undefined}
      title="Профиль"
      onBack={onBack}
      actions={actions}
    />
  );
}
