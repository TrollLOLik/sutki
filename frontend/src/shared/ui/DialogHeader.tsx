import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/cx';
import { IconButton } from './IconButton';
import { DescriptionText, SectionTitle } from './Typography';

export type DialogTone = 'primary' | 'neutral' | 'success' | 'warning' | 'danger';

export interface DialogHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: DialogTone;
  onClose: () => void;
  titleId?: string;
  descriptionId?: string;
  closeLabel?: string;
  showClose?: boolean;
  className?: string;
}

export function DialogHeader({
  title,
  description,
  icon,
  tone = 'primary',
  onClose,
  titleId,
  descriptionId,
  closeLabel = 'Закрыть',
  showClose = true,
  className,
}: DialogHeaderProps) {
  return (
    <header className={cx('ui-dialog-header', !icon && 'ui-dialog-header--without-icon', !showClose && 'ui-dialog-header--without-close', `ui-dialog-header--${tone}`, className)}>
      {icon ? <span className="ui-dialog-header__icon" aria-hidden="true">{icon}</span> : null}
      <div className="ui-dialog-header__copy">
        <SectionTitle as="h2" id={titleId}>{title}</SectionTitle>
        {description ? <DescriptionText as="p" id={descriptionId}>{description}</DescriptionText> : null}
      </div>
      {showClose ? <IconButton className="ui-dialog-header__close" label={closeLabel} size="sm" mode="soft" tone="neutral" icon={<X />} onClick={onClose} /> : null}
    </header>
  );
}
