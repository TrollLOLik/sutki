import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@shared/lib/cx';
import { IconButton } from './IconButton';
import { DescriptionText, PageTitle } from './Typography';

export interface DesktopPageHeadingProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  actions?: ReactNode;
  className?: string;
}

export function DesktopPageHeading({ title, subtitle, onBack, actions, className }: DesktopPageHeadingProps) {
  return (
    <header className={cx('ui-desktop-page-heading', className)}>
      <IconButton label="Назад" size="sm" mode="soft" tone="neutral" icon={<ChevronLeft size={23} />} onClick={onBack} />
      <div><PageTitle>{title}</PageTitle>{subtitle ? <DescriptionText as="p">{subtitle}</DescriptionText> : null}</div>
      {actions ? <span>{actions}</span> : null}
    </header>
  );
}
