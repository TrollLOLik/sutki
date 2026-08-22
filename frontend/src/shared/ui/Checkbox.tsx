import type { InputHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export function Checkbox({ label, description, className, ...props }: CheckboxProps) {
  return (
    <label className={cx('ui-checkbox', props.disabled && 'ui-checkbox--disabled', className)}>
      <input {...props} type="checkbox" />
      <span className="ui-checkbox__box"><Check size={14} /></span>
      <span className="ui-checkbox__copy"><strong><BodyText className="ui-text--inherit-metrics" color="inherit">{label}</BodyText></strong>{description ? <small><DescriptionText className="ui-text--inherit-metrics" color="inherit">{description}</DescriptionText></small> : null}</span>
    </label>
  );
}
