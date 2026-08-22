import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';

export interface IconValueRowProps extends HTMLAttributes<HTMLDivElement> {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  iconClassName?: string;
  copyClassName?: string;
}

export function IconValueRow({ icon, label, value, iconClassName, copyClassName, className, ...props }: IconValueRowProps) {
  return <div {...props} className={cx('ui-icon-value-row', className)}><span className={cx('ui-icon-value-row__icon', iconClassName)}>{icon}</span><span className={cx('ui-icon-value-row__copy', copyClassName)}><DescriptionText as="small" className="ui-text--inherit-metrics" color="inherit">{label}</DescriptionText><BodyText as="strong" className="ui-text--inherit-metrics" weight={500} color="inherit">{value}</BodyText></span></div>;
}
