import { useRef } from 'react';
import { Pressable, Text, TextInput } from 'react-native';

import { Input } from '@/components/ui/Input';
import { formatPhoneMask } from '@/lib/phone';
import { useAppTheme } from '@/theme/useAppTheme';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  autoFocus?: boolean;
}

export function PhoneInput({ value, onChange, onBlur, error, autoFocus = false }: PhoneInputProps) {
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Код страны Россия плюс семь"
          hitSlop={8}
          onPress={() => inputRef.current?.focus()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRightWidth: 1,
            borderRightColor: palette.line,
            paddingRight: 12,
          }}>
          <Text style={{ fontSize: 19, lineHeight: 23 }}>🇷🇺</Text>
          <Text style={{ color: palette.ink, fontSize: 16, fontWeight: '700' }}>+7</Text>
        </Pressable>
      }
    />
  );
}
