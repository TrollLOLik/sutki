import { useRef } from 'react';
import { TextInput } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Input } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/PressableScale';
import { formatPhoneMask } from '@/lib/phone';
import { useAppTheme } from '@/theme/useAppTheme';

const RUSSIAN_FLAG = String.fromCodePoint(0x1f1f7, 0x1f1fa);

export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  autoFocus?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  error,
  autoFocus = false,
}: PhoneInputProps) {
  const { palette } = useAppTheme();
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    onChange(formatPhoneMask(digits));
  };

  return (
    <Input
      ref={inputRef}
      autoFocus={autoFocus}
      value={value}
      onChangeText={handleChangeText}
      onBlur={onBlur}
      keyboardType="phone-pad"
      autoComplete="tel"
      textContentType="telephoneNumber"
      placeholder="(999) 000-00-00"
      maxLength={15}
      error={error}
      before={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Код страны Россия плюс семь"
          hitSlop={8}
          pressedScale={0.985}
          onPress={() => inputRef.current?.focus()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRightWidth: 1,
            borderRightColor: palette.line,
            paddingRight: 12,
          }}>
          <AppText style={{ fontSize: 19, lineHeight: 23 }}>{RUSSIAN_FLAG}</AppText>
          <AppText variant="bodyStrong">+7</AppText>
        </PressableScale>
      }
    />
  );
}
