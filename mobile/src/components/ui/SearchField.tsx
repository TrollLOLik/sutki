import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  View,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  containerStyle?: StyleProp<ViewStyle>;
  onChangeText: (value: string) => void;
  value: string;
}

export function SearchField({
  containerStyle,
  onBlur,
  onChangeText,
  onFocus,
  placeholder = 'Поиск',
  value,
  ...inputProps
}: SearchFieldProps) {
  const { palette } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        {
          height: 48,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 13,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: focused ? palette.primary : palette.line,
          backgroundColor: palette.surface,
          shadowColor: '#1A1A1A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: focused ? 0.14 : 0.1,
          shadowRadius: focused ? 9 : 6,
          elevation: focused ? 4 : 3,
        },
        containerStyle,
      ]}>
      <Ionicons name="search" size={20} color={focused ? palette.primary : palette.inkMuted} />
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholder={placeholder}
        placeholderTextColor={palette.inkMuted}
        returnKeyType={inputProps.returnKeyType ?? 'search'}
        selectionColor={palette.primary}
        style={{
          flex: 1,
          height: '100%',
          marginLeft: 8,
          paddingVertical: 0,
          fontSize: 14,
          fontWeight: '500',
          color: palette.ink,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityLabel="Очистить поиск"
          hitSlop={8}
          onPress={() => onChangeText('')}
          style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close-circle" size={19} color={palette.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
