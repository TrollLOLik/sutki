import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/cx';
import { DescriptionText } from './Typography';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  removable?: boolean;
  shape?: 'pill' | 'circle';
  before?: ReactNode;
  onRemove?: () => void;
}

export function Chip({ selected = false, removable = false, shape = 'pill', before, onRemove, children, className, type = 'button', onClick, ...props }: ChipProps) {
  return (
    <span className={cx('ui-chip-wrap', className)}>
      <button {...props} type={type} className={cx('ui-chip', `ui-chip--${shape}`, selected && 'ui-chip--selected', selected && 'selected')} onClick={onClick}>
        {before}{typeof children === 'string' || typeof children === 'number' ? <DescriptionText className="ui-text--inherit-metrics" color="inherit">{children}</DescriptionText> : children}
      </button>
      {removable ? <button type="button" className="ui-chip__remove" aria-label="Удалить" onClick={onRemove}><X size={14} /></button> : null}
    </span>
  );
}
