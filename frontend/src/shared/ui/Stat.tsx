import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { DescriptionText, SectionTitle } from './Typography';

export interface StatProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> {
  icon?: ReactNode;
  value: ReactNode;
  label: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  iconClassName?: string;
  copyClassName?: string;
  wrapIcon?: boolean;
  wrapCopy?: boolean;
}

export function Stat({ icon, value, label, onClick, iconClassName, copyClassName, wrapIcon = false, wrapCopy = true, className, ...props }: StatProps) {
  const copy = <><SectionTitle as="strong" className="ui-text--inherit-metrics" color="inherit" truncate>{value}</SectionTitle><DescriptionText as={wrapCopy ? 'small' : 'span'} className="ui-text--inherit-metrics" color="inherit">{label}</DescriptionText></>;
  const content = (
    <>
      {icon ? (wrapIcon ? <span className={cx('ui-stat__icon', iconClassName)}>{icon}</span> : icon) : null}
      {wrapCopy ? <span className={cx('ui-stat__copy', copyClassName)}>{copy}</span> : copy}
    </>
  );

  if (onClick) {
    return <button type="button" className={cx('ui-stat', 'ui-stat--interactive', className)} onClick={onClick}>{content}</button>;
  }

  return <div {...props} className={cx('ui-stat', className)}>{content}</div>;
}
