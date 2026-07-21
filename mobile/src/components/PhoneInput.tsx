import { useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { formatPhoneMask } from '@/lib/phone';

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  autoFocus?: boolean;
}

export function PhoneInput({ value, onChange, onBlur, error, autoFocus = false }: PhoneInputProps) {
  const { palette, isDark } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    onChange(formatPhoneMask(digits));
  };

  const borderColor = error ? palette.danger : focused ? palette.primary : palette.line;

  return (
    <View style={{ width: '100%' }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 18,
          borderWidth: 1,
          borderColor,
          backgroundColor: isDark ? '#202329' : '#F0F1F3',
          paddingHorizontal: 16,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingRight: 12,
            borderRightWidth: 1,
            borderRightColor: palette.line,
          }}>
          <Text style={{ fontSize: 19, lineHeight: 23 }}>🇷🇺</Text>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: focused ? palette.primary : palette.ink,
            }}>
            +7
          </Text>
        </View>

        <TextInput
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          keyboardType="phone-pad"
          placeholder="(999) 000-00-00"
          placeholderTextColor={palette.inkMuted}
          style={{
            flex: 1,
            height: '100%',
            marginLeft: 12,
            fontSize: 16,
            color: palette.ink,
          }}
          maxLength={15}
        />
      </TouchableOpacity>

      {error ? (
        <Text style={{ marginTop: 6, paddingHorizontal: 4, fontSize: 12, fontWeight: '500', color: palette.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
