import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from '../lib/cx';
import { BadgeText, BodyText, DescriptionText } from './Typography';

export interface ListCellProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  before?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  after?: ReactNode;
  chevron?: boolean;
  multiline?: boolean;
  beforeClassName?: string;
  copyClassName?: string;
  afterClassName?: string;
}

export function ListCell({ before, eyebrow, title, subtitle, after, chevron = true, multiline = false, beforeClassName, copyClassName, afterClassName, className, type = 'button', ...props }: ListCellProps) {
  return (
    <button {...props} type={type} className={cx('ui-list-cell', multiline && 'ui-list-cell--multiline', className)}>
      {before ? <span className={cx('ui-list-cell__before', beforeClassName)}>{before}</span> : null}
      <span className={cx('ui-list-cell__copy', copyClassName)}>
        {eyebrow ? <small className="ui-list-cell__eyebrow"><BadgeText className="ui-text--inherit-metrics" color="inherit">{eyebrow}</BadgeText></small> : null}
        <strong><BodyText className="ui-text--inherit-metrics" color="inherit">{title}</BodyText></strong>
        {subtitle ? <small><DescriptionText className="ui-text--inherit-metrics" color="inherit">{subtitle}</DescriptionText></small> : null}
      </span>
      {after ? <span className={cx('ui-list-cell__after', afterClassName)}>{after}</span> : null}
      {chevron ? <ChevronRight className="ui-list-cell__chevron" size={18} aria-hidden="true" /> : null}
    </button>
  );
}

export interface ListCellLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'title'> {
  before?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  after?: ReactNode;
  chevron?: boolean;
  multiline?: boolean;
  beforeClassName?: string;
  copyClassName?: string;
  afterClassName?: string;
}

export function ListCellLink({ before, eyebrow, title, subtitle, after, chevron = true, multiline = false, beforeClassName, copyClassName, afterClassName, className, ...props }: ListCellLinkProps) {
  return <a {...props} className={cx('ui-list-cell', 'ui-list-cell--link', multiline && 'ui-list-cell--multiline', className)}>
    {before ? <span className={cx('ui-list-cell__before', beforeClassName)}>{before}</span> : null}
    <span className={cx('ui-list-cell__copy', copyClassName)}>
      {eyebrow ? <small className="ui-list-cell__eyebrow"><BadgeText className="ui-text--inherit-metrics" color="inherit">{eyebrow}</BadgeText></small> : null}
      <strong><BodyText className="ui-text--inherit-metrics" color="inherit">{title}</BodyText></strong>
      {subtitle ? <small><DescriptionText className="ui-text--inherit-metrics" color="inherit">{subtitle}</DescriptionText></small> : null}
    </span>
    {after ? <span className={cx('ui-list-cell__after', afterClassName)}>{after}</span> : null}
    {chevron ? <ChevronRight className="ui-list-cell__chevron" size={18} aria-hidden="true" /> : null}
  </a>;
}
