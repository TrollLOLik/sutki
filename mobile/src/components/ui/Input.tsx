import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export interface InputProps extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
  before?: ReactNode;
  after?: ReactNode;
  error?: string;
  invalid?: boolean;
  size?: 'md' | 'lg';
  containerStyle?: StyleProp<ViewStyle>;
  frameStyle?: StyleProp<ViewStyle>;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    icon,
    before,
    after,
    error,
    invalid = false,
    size = 'lg',
    containerStyle,
    frameStyle,
    className,
    onFocus,
    onBlur,
    editable = true,
    style,
    ...rest
  },
  ref,
) {
  const { palette } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error || invalid);
  const height = size === 'md' ? 48 : 56;
  const radius = size === 'md' ? 16 : 18;

  return (
    <View style={[{ width: '100%', opacity: editable ? 1 : 0.48 }, containerStyle]}>
      <View
        style={[
          {
            height,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
            borderRadius: radius,
            borderWidth: hasError || isFocused ? 1.5 : 1,
            borderColor: hasError ? palette.danger : isFocused ? palette.primary : palette.line,
            backgroundColor: palette.surfaceMuted,
            paddingHorizontal: 16,
          },
          frameStyle,
        ]}>
        {before ? (
          <View style={{ flexShrink: 0, marginRight: 12 }}>{before}</View>
        ) : icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={hasError ? palette.danger : isFocused ? palette.primary : palette.inkMuted}
            style={{ marginRight: 10 }}
          />
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={palette.inkMuted}
          selectionColor={palette.primary}
          editable={editable}
          className={className}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              minWidth: 0,
              flex: 1,
              height: '100%',
              paddingVertical: 0,
              color: palette.ink,
              fontSize: 16,
            },
            style,
          ]}
          {...rest}
        />
        {after ? <View style={{ flexShrink: 0, marginLeft: 10 }}>{after}</View> : null}
      </View>
      {error ? <Text className="mt-1.5 px-1 text-xs font-medium text-danger">{error}</Text> : null}
    </View>
  );
});
