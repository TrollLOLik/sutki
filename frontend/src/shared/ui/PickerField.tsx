import { ChevronRight } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';
import type { TextFieldSize } from './TextField';

export interface PickerFieldProps {
  label: string;
  value: string;
  onClick: () => void;
  before?: ReactNode;
  after?: ReactNode;
  placeholder?: boolean;
  accent?: boolean;
  disabled?: boolean;
  size?: TextFieldSize;
  className?: string;
  ariaLabel?: string;
}

export interface PickerButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  placeholder?: boolean;
  size?: TextFieldSize;
}

export function PickerButton({ value, before, after = <ChevronRight />, placeholder = false, size = 'md', className, type = 'button', ...props }: PickerButtonProps) {
  return (
    <button {...props} type={type} className={cx('ui-input', 'ui-input--system', `ui-input--${size}`, 'ui-picker-input', placeholder && 'is-placeholder', className)}>
      {before ? <span className="ui-picker-input__before" aria-hidden="true">{before}</span> : null}
      <BodyText className="ui-picker-input__value" color={placeholder ? 'muted' : 'default'} truncate>{value}</BodyText>
      {after ? <span className="ui-picker-input__after" aria-hidden="true">{after}</span> : null}
    </button>
  );
}

export function PickerField({ label, value, onClick, before, after = <ChevronRight />, placeholder = false, accent = false, disabled = false, size = 'md', className, ariaLabel }: PickerFieldProps) {
  return (
    <div className={cx('ui-field', 'ui-picker-field', accent && 'ui-picker-field--accent', className)}>
      <DescriptionText className="ui-picker-field__label">{label}</DescriptionText>
      <PickerButton
        size={size}
        value={value}
        before={before}
        after={after}
        placeholder={placeholder}
        aria-label={ariaLabel ?? `${label}: ${value}`}
        disabled={disabled}
        onClick={onClick}
      />
    </div>
  );
}

export interface PhonePickerFieldProps extends Omit<PickerFieldProps, 'before' | 'value'> {
  value?: string;
  countryFlag?: string;
  countryName?: string;
  dialCode?: string;
  placeholderValue?: string;
}

export function PhonePickerField({ value = '', countryFlag = '🇷🇺', countryName = 'Россия', dialCode = '+7', placeholderValue = '(999) 000-00-00', ...props }: PhonePickerFieldProps) {
  const visibleValue = value || placeholderValue;
  return (
    <PickerField
      {...props}
      value={visibleValue}
      placeholder={!value}
      before={(
        <span className="ui-phone-input__country">
          <span role="img" aria-label={countryName}>{countryFlag}</span>
          <BodyText as="strong" className="ui-text--inherit-metrics" color="inherit">{dialCode}</BodyText>
        </span>
      )}
    />
  );
}
