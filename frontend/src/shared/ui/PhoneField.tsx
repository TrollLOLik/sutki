import type { TextFieldProps } from './TextField';
import { TextField } from './TextField';
import { BodyText } from './Typography';

export interface PhoneFieldProps extends Omit<TextFieldProps, 'before' | 'type'> {
  countryFlag?: string;
  countryName?: string;
  dialCode?: string;
}

export function PhoneField({
  countryFlag = '🇷🇺',
  countryName = 'Россия',
  dialCode = '+7',
  inputMode = 'tel',
  autoComplete = 'tel',
  placeholder = '(999) 000-00-00',
  ...props
}: PhoneFieldProps) {
  return (
    <TextField
      {...props}
      type="tel"
      inputMode={inputMode}
      autoComplete={autoComplete}
      placeholder={placeholder}
      before={(
        <span className="ui-phone-input__country">
          <span role="img" aria-label={countryName}>{countryFlag}</span>
          <BodyText as="strong" className="ui-text--inherit-metrics" color="inherit">{dialCode}</BodyText>
        </span>
      )}
    />
  );
}
