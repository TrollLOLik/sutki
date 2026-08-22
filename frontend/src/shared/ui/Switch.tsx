import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  before?: ReactNode;
}

export function Switch({ label, description, before, className, ...props }: SwitchProps) {
  return (
    <label className={cx('ui-switch-row', props.disabled && 'ui-switch-row--disabled', className)}>
      {before ? <span className="ui-switch-row__before">{before}</span> : null}
      <span className="ui-switch-row__copy"><strong><BodyText className="ui-text--inherit-metrics" color="inherit">{label}</BodyText></strong>{description ? <small><DescriptionText className="ui-text--inherit-metrics" color="inherit">{description}</DescriptionText></small> : null}</span>
      <span className="ui-switch"><input {...props} type="checkbox" /><i /></span>
    </label>
  );
}
