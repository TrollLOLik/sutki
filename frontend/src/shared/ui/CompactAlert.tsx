import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BadgeText, BodyText, DescriptionText, type TextColor } from './Typography';

export type CompactAlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface CompactAlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: CompactAlertTone;
  title?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  descriptionColor?: TextColor;
  children: ReactNode;
}

const toneIcons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
};

export function CompactAlert({ tone = 'info', title, meta, icon, descriptionColor = 'inherit', children, className, ...props }: CompactAlertProps) {
  const Icon = toneIcons[tone];
  return (
    <div {...props} className={cx('ui-compact-alert', `ui-compact-alert--${tone}`, className)} role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}>
      <span className="ui-compact-alert__icon" aria-hidden="true">{icon ?? <Icon />}</span>
      <div className="ui-compact-alert__copy">
        {title ? <BodyText as="strong" weight={500} color="inherit">{title}</BodyText> : null}
        <DescriptionText as="p" color={descriptionColor}>{children}</DescriptionText>
        {meta ? <BadgeText as="small" weight={400} color="muted">{meta}</BadgeText> : null}
      </div>
    </div>
  );
}
