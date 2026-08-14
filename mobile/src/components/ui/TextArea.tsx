import { forwardRef, useState } from 'react';
import {
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FieldFrame } from '@/components/ui/FieldFrame';
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
    <FieldFrame
      focused={focused}
      invalid={invalid}
      multiline
      minHeight={minHeight}
      contentPaddingHorizontal={0}
      style={containerStyle}>
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
        <AppText
          variant="caption"
          tone={invalid ? 'danger' : 'muted'}
          style={{
            paddingRight: 12,
            paddingBottom: 9,
            textAlign: 'right',
            fontSize: 11,
            lineHeight: 14,
            fontWeight: '400',
          }}>
          {length} / {maxLength}
        </AppText>
      ) : null}
    </FieldFrame>
  );
});
