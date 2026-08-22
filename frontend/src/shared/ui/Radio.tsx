import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export function Radio({ label, description, className, ...props }: RadioProps) {
  return (
    <label className={cx('ui-radio', props.disabled && 'ui-radio--disabled', className)}>
      <input {...props} type="radio" />
      <span className="ui-radio__dot" />
      <span className="ui-radio__copy"><strong><BodyText className="ui-text--inherit-metrics" color="inherit">{label}</BodyText></strong>{description ? <small><DescriptionText className="ui-text--inherit-metrics" color="inherit">{description}</DescriptionText></small> : null}</span>
    </label>
  );
}
