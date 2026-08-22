import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { DescriptionText } from './Typography';

export interface KeyValueRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> {
  label: ReactNode;
  value: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  valueColor?: 'default' | 'accent' | 'secondary' | 'muted' | 'danger' | 'success' | 'inverse' | 'inherit';
}

export function KeyValueRow({ label, value, onClick, valueColor = 'default', className, ...props }: KeyValueRowProps) {
  const content = <><DescriptionText>{label}</DescriptionText><DescriptionText as="strong" color={valueColor} truncate>{value}</DescriptionText></>;
  if (onClick) return <button type="button" className={cx('ui-key-value-row', 'ui-key-value-row--interactive', className)} onClick={onClick}>{content}</button>;
  return <div {...props} className={cx('ui-key-value-row', className)}>{content}</div>;
}
