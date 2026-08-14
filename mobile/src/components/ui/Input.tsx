import { forwardRef, useState, type ReactNode } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { FieldFrame, type FieldFrameSize } from '@/components/ui/FieldFrame';
import { useAppTheme } from '@/theme/useAppTheme';

export interface InputProps extends TextInputProps {
  icon?: AppIconName;
  before?: ReactNode;
  after?: ReactNode;
  error?: string;
  invalid?: boolean;
  size?: FieldFrameSize;
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

  return (
    <View style={[{ width: '100%', opacity: editable ? 1 : 0.48 }, containerStyle]}>
      <FieldFrame
        size={size}
        focused={isFocused}
        invalid={hasError}
        style={frameStyle}>
        {before ? (
          <View style={{ flexShrink: 0, marginRight: 12 }}>{before}</View>
        ) : icon ? (
          <AppIcon
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
      </FieldFrame>
      {error ? (
        <AppText
          variant="caption"
          tone="danger"
          accessibilityLiveRegion="polite"
          style={{ marginTop: 6, paddingHorizontal: 4 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});
