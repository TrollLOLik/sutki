import { forwardRef, useState } from 'react';
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export interface TextAreaProps extends Omit<TextInputProps, 'multiline'> {
  containerStyle?: StyleProp<ViewStyle>;
  invalid?: boolean;
  minHeight?: number;
  showCount?: boolean;
}

export const TextArea = forwardRef<TextInput, TextAreaProps>(function TextArea(
  {
    containerStyle,
    invalid = false,
    minHeight = 132,
    showCount = false,
    maxLength,
    value,
    defaultValue,
    onFocus,
    onBlur,
    style,
    ...rest
  },
  ref,
) {
  const { palette } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const length = String(value ?? defaultValue ?? '').length;

  return (
    <View
      style={[
        {
          minHeight,
          overflow: 'hidden',
          borderRadius: 18,
          borderWidth: focused || invalid ? 1.5 : 1,
          borderColor: invalid ? palette.danger : focused ? palette.primary : palette.line,
          backgroundColor: palette.surfaceMuted,
        },
        containerStyle,
      ]}>
      <TextInput
        ref={ref}
        {...rest}
        value={value}
        defaultValue={defaultValue}
        multiline
        maxLength={maxLength}
        placeholderTextColor={palette.inkMuted}
        selectionColor={palette.primary}
        scrollEnabled
        textAlignVertical="top"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          {
            minHeight: showCount ? minHeight - 28 : minHeight - 2,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: showCount ? 4 : 14,
            color: palette.ink,
            fontSize: 16,
            lineHeight: 22,
          },
          style,
        ]}
      />
      {showCount && maxLength ? (
        <Text
          style={{
            paddingRight: 12,
            paddingBottom: 9,
            textAlign: 'right',
            color: invalid ? palette.danger : palette.inkMuted,
            fontSize: 11,
            lineHeight: 14,
          }}>
          {length} / {maxLength}
        </Text>
      ) : null}
    </View>
  );
});
