import { useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { formatPhoneMask } from '@/lib/phone';

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}

export function PhoneInput({ value, onChange, onBlur, error }: PhoneInputProps) {
  const { palette } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    onChange(formatPhoneMask(digits));
  };

  const borderColor = error
    ? palette.danger
    : focused
    ? palette.primary
    : palette.line;

  return (
    <View style={{ width: '100%' }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 12,
          borderWidth: 1,
          borderColor,
          backgroundColor: palette.surface,
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        {/* Flag + prefix */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingRight: 10,
            borderRightWidth: 1,
            borderRightColor: palette.line,
          }}
        >
          <Text style={{ fontSize: 20, lineHeight: 24 }}>🇷🇺</Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: focused ? palette.primary : palette.ink,
              letterSpacing: 0.3,
            }}
          >
            +7
          </Text>
        </View>

        {/* Masked input */}
        <TextInput
          ref={inputRef}
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
            fontSize: 15,
            color: palette.ink,
          }}
          maxLength={15} // "(XXX) XXX-XX-XX" = 15 chars
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
