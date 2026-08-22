import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export type TextFieldSize = 'sm' | 'md' | 'lg';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  before?: ReactNode;
  after?: ReactNode;
  invalid?: boolean;
  size?: TextFieldSize;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ before, after, invalid = false, size = 'lg', className, ...props }, ref) {
  return (
    <span className={cx('ui-input', 'ui-input--system', `ui-input--${size}`, invalid && 'ui-input--invalid', props.disabled && 'ui-input--disabled', className)}>
      {before ? <span className="ui-input__before">{before}</span> : null}
      <input {...props} ref={ref} aria-invalid={invalid || undefined} />
      {after ? <span className="ui-input__after">{after}</span> : null}
    </span>
  );
});
