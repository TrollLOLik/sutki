import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BadgeText } from './Typography';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  before?: ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({ className, tone = 'neutral', before, size = 'sm', children, ...props }: BadgeProps) {
  return <span {...props} className={cx('ui-badge', `ui-badge--${tone}`, `ui-badge--${size}`, className)}>{before}<BadgeText className="ui-text--inherit-metrics" color="inherit">{children}</BadgeText></span>;
}
