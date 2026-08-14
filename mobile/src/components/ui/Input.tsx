import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  FadeOutUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
  const reduceMotion = useReducedMotion();
  const iconState = useSharedValue(hasError ? 2 : isFocused ? 1 : 0);

  useEffect(() => {
    const target = hasError ? 2 : isFocused ? 1 : 0;
    iconState.value = reduceMotion
      ? target
      : withTiming(target, { duration: 170, easing: Easing.out(Easing.cubic) });
  }, [hasError, iconState, isFocused, reduceMotion]);

  const idleIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(iconState.value, [0, 0.8], [1, 0], Extrapolation.CLAMP),
  }));
  const focusIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(iconState.value, [0, 0.8, 1, 1.2, 2], [0, 0, 1, 0, 0], Extrapolation.CLAMP),
  }));
  const errorIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(iconState.value, [1.2, 2], [0, 1], Extrapolation.CLAMP),
  }));

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
          <View style={{ width: 20, height: 20, flexShrink: 0, marginRight: 10 }}>
            <Animated.View style={[{ position: 'absolute' }, idleIconStyle]}>
              <AppIcon name={icon} size={20} color={palette.inkMuted} />
            </Animated.View>
            <Animated.View style={[{ position: 'absolute' }, focusIconStyle]}>
              <AppIcon name={icon} size={20} color={palette.primary} />
            </Animated.View>
            <Animated.View style={[{ position: 'absolute' }, errorIconStyle]}>
              <AppIcon name={icon} size={20} color={palette.danger} />
            </Animated.View>
          </View>
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
        <Animated.View
          key={error}
          entering={reduceMotion ? undefined : FadeInDown.duration(150).springify().damping(20)}
          exiting={reduceMotion ? undefined : FadeOutUp.duration(110)}>
          <AppText
            variant="caption"
            tone="danger"
            accessibilityLiveRegion="polite"
            style={{ marginTop: 6, paddingHorizontal: 4 }}>
            {error}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
});
