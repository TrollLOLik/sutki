import type { ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { IconButton } from './IconButton';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';

export interface AppHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  closeLabel?: string;
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}

export function AppHeader({ title, subtitle, onBack, onClose, closeLabel = 'Закрыть', actions, sticky = true, className }: AppHeaderProps) {
  return (
    <header className={cx('ui-app-header', sticky && 'ui-app-header--sticky', className)}>
      <div className="ui-app-header__side">
        {onBack ? <IconButton label="Назад" size="sm" mode="soft" tone="neutral" icon={<ChevronLeft size={24} />} onClick={onBack} /> : onClose ? <IconButton label={closeLabel} variant="plain" icon={<X size={22} />} onClick={onClose} /> : null}
      </div>
      <div className="ui-app-header__copy"><strong><BodyText className="ui-text--inherit-metrics" color="inherit">{title}</BodyText></strong>{subtitle ? <small><DescriptionText className="ui-text--inherit-metrics" color="inherit">{subtitle}</DescriptionText></small> : null}</div>
      <div className="ui-app-header__side ui-app-header__side--right">{actions}</div>
    </header>
  );
}
