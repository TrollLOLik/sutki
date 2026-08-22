import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../lib/cx';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ invalid = false, className, children, ...props }: SelectProps) {
  return (
    <span className={cx('ui-select', invalid && 'ui-select--invalid', props.disabled && 'ui-select--disabled', className)}>
      <select {...props} aria-invalid={invalid || undefined}>{children}</select>
      <ChevronDown size={17} aria-hidden="true" />
    </span>
  );
}
