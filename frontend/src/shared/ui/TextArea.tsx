import type { TextareaHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { BadgeText } from './Typography';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  showCount?: boolean;
  bare?: boolean;
}

export function TextArea({ invalid = false, showCount = false, bare = false, maxLength, value, defaultValue, className, ...props }: TextAreaProps) {
  const length = String(value ?? defaultValue ?? '').length;
  if (bare) return <textarea {...props} className={className} value={value} defaultValue={defaultValue} maxLength={maxLength} aria-invalid={invalid || undefined} />;
  return (
    <span className={cx('ui-textarea', invalid && 'ui-textarea--invalid', props.disabled && 'ui-textarea--disabled', className)}>
      <textarea {...props} value={value} defaultValue={defaultValue} maxLength={maxLength} aria-invalid={invalid || undefined} />
      {showCount && maxLength ? <BadgeText as="small" className="ui-text--inherit-metrics" color="inherit">{length}/{maxLength}</BadgeText> : null}
    </span>
  );
}
