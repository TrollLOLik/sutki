import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';

export interface ToggleCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'onChange'> {
  checked: boolean;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  onChange: () => void;
}

export function ToggleCard({ checked, icon, title, description, onChange, className, type = 'button', ...props }: ToggleCardProps) {
  return (
    <button
      {...props}
      type={type}
      role="switch"
      aria-checked={checked}
      className={cx('ui-toggle-card', 'filter-toggle-card', checked && 'selected', className)}
      onClick={onChange}
    >
      {icon ? <span className="ui-toggle-card__icon filter-toggle-icon" aria-hidden="true">{icon}</span> : null}
      <span className="ui-toggle-card__copy filter-toggle-copy">
        <BodyText as="strong" weight={500}>{title}</BodyText>
        {description ? <DescriptionText as="small">{description}</DescriptionText> : null}
      </span>
      <span className={cx('ui-toggle-card__switch', 'web-switch', checked && 'checked')} aria-hidden="true"><i /></span>
    </button>
  );
}
