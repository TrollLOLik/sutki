import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BadgeText, DescriptionText } from './Typography';

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  action?: ReactNode;
  labelFor?: string;
  messageId?: string;
}

export function Field({ label, description, error, required, action, labelFor, messageId, children, className, ...props }: FieldProps) {
  return (
    <div {...props} className={cx('ui-field', error && 'ui-field--error', className)}>
      {label || action ? (
        <div className="ui-field__head">
          {label ? <label className="ui-field__label" htmlFor={labelFor}><DescriptionText className="ui-text--inherit-metrics" color="inherit">{label}{required ? <span aria-hidden="true"> *</span> : null}</DescriptionText></label> : <span />}
          {action}
        </div>
      ) : null}
      {children}
      {error ? <p id={messageId} className="ui-field__message" role="alert"><BadgeText className="ui-text--inherit-metrics" color="inherit">{error}</BadgeText></p> : description ? <p id={messageId} className="ui-field__description"><DescriptionText className="ui-text--inherit-metrics" color="inherit">{description}</DescriptionText></p> : null}
    </div>
  );
}
