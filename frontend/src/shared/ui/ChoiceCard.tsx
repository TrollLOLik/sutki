import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';

export interface ChoiceCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  selected: boolean;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  showIndicator?: boolean;
  iconClassName?: string;
  metaClassName?: string;
}

export function ChoiceCard({ selected, icon, title, description, meta, showIndicator = true, iconClassName, metaClassName, className, type = 'button', ...props }: ChoiceCardProps) {
  return <button {...props} type={type} aria-pressed={selected} className={cx('ui-choice-card', selected && 'selected', className)}>
    {icon ? <span className={cx('ui-choice-card__icon', iconClassName)}>{icon}</span> : null}
    {selected && showIndicator ? <i className="ui-choice-card__indicator" aria-hidden="true"><Check size={14} /></i> : null}
    <BodyText as="strong" className="ui-text--inherit-metrics" weight={500} color="inherit">{title}</BodyText>
    {description ? <DescriptionText as="small" className="ui-text--inherit-metrics" color="inherit">{description}</DescriptionText> : null}
    {meta ? <span className={cx('ui-choice-card__meta', metaClassName)}>{meta}</span> : null}
  </button>;
}
