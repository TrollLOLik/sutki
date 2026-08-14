import { forwardRef, useState } from 'react';
import {
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { FieldFrame } from '@/components/ui/FieldFrame';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAppTheme } from '@/theme/useAppTheme';

export interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  containerStyle?: StyleProp<ViewStyle>;
  onChangeText: (value: string) => void;
  value: string;
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  {
    containerStyle,
    onBlur,
    onChangeText,
    onFocus,
    placeholder = 'Поиск',
    value,
    editable = true,
    ...inputProps
  },
  ref,
) {
  const { palette } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <FieldFrame
      size="md"
      focused={focused}
      contentPaddingHorizontal={13}
      style={[
        {
          borderRadius: 24,
          borderWidth: 1,
          backgroundColor: palette.surface,
          shadowColor: '#1A1A1A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: focused ? 0.14 : 0.1,
          shadowRadius: focused ? 9 : 6,
          elevation: focused ? 4 : 3,
          opacity: editable ? 1 : 0.48,
        },
        containerStyle,
      ]}>
      <AppIcon
        name="search"
        size={20}
        color={focused ? palette.primary : palette.inkMuted}
      />
      <TextInput
        ref={ref}
        {...inputProps}
        value={value}
        editable={editable}
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
          color: palette.ink,
          fontSize: 14,
          fontWeight: '500',
        }}
      />
      {value.length > 0 ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Очистить поиск"
          hitSlop={8}
          pressedScale={0.9}
          onPress={() => onChangeText('')}
          style={{
            width: 30,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppIcon name="close-circle" size={19} tone="muted" />
        </PressableScale>
      ) : null}
    </FieldFrame>
  );
});
