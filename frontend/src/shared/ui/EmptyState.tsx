import type { ReactNode } from 'react';
import { SearchX } from 'lucide-react';
import { cx } from '@shared/lib/cx';
import { Button } from './Button';
import { DescriptionText, SectionTitle } from './Typography';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon = <SearchX size={38} />, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return <section className={cx('ui-empty-state', className)}><div className="ui-empty-state__icon">{icon}</div><SectionTitle>{title}</SectionTitle>{description ? <DescriptionText as="p">{description}</DescriptionText> : null}{actionLabel && onAction ? <Button mode="solid" tone="primary" onClick={onAction}>{actionLabel}</Button> : null}</section>;
}
