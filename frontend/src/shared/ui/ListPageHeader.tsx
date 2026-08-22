import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { AppHeader } from './AppHeader';
import { DesktopPageHeading } from './DesktopPageHeading';
import { PageTitle } from './Typography';

export interface ListPageHeaderProps {
  presentation: 'mobile' | 'desktop';
  title: string;
  subtitle?: string;
  onBack: () => void;
  actions?: ReactNode;
  className?: string;
}

export function ListPageHeader({ presentation, title, subtitle, onBack, actions, className }: ListPageHeaderProps) {
  if (presentation === 'desktop') {
    return <DesktopPageHeading className={cx('ui-list-page-header', 'ui-list-page-header--desktop', className)} title={title} subtitle={subtitle} onBack={onBack} actions={actions} />;
  }

  return (
    <AppHeader
      className={cx('ui-list-page-header', 'ui-list-page-header--mobile', className)}
      title={<PageTitle as="span" truncate>{title}</PageTitle>}
      subtitle={subtitle}
      onBack={onBack}
      actions={actions}
    />
  );
}
