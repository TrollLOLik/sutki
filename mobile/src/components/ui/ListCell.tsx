import { useEffect, useState, type ReactNode } from 'react';
import { View, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { pressMotion } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export interface ListCellProps extends Omit<PressableProps, 'children'> {
  before?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  after?: ReactNode;
  chevron?: boolean;
  multiline?: boolean;
}

function renderCopy(value: ReactNode, type: 'title' | 'subtitle', color: string) {
  return typeof value === 'string' || typeof value === 'number' ? (
    <AppText
      variant={type === 'title' ? 'label' : 'caption'}
      numberOfLines={type === 'title' ? 1 : 2}
      style={{
        color,
        fontSize: type === 'title' ? 15 : 12,
        lineHeight: type === 'title' ? 20 : 17,
        fontWeight: type === 'title' ? '800' : '500',
      }}>
      {value}
    </AppText>
  ) : (
    value
  );
}

export function ListCell({
  before,
  title,
  subtitle,
  after,
  chevron = true,
  multiline = false,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ListCellProps) {
  const { palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const pressProgress = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pressProgress.value * 3 }],
  }));

  useEffect(() => {
    pressProgress.value = reduceMotion
      ? 0
      : pressed
        ? withTiming(1, { duration: 75 })
        : withSpring(0, pressMotion.spring);
  }, [pressProgress, pressed, reduceMotion]);

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = (event) => {
    setPressed(true);
    onPressIn?.(event);
  };
  const handlePressOut: NonNullable<PressableProps['onPressOut']> = (event) => {
    setPressed(false);
    onPressOut?.(event);
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      disabledOpacity={0.46}
      pressedScale={1}
      pressedOpacity={0.96}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={(state) => [
        {
          minHeight: multiline || subtitle ? 68 : 56,
          width: '100%',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <View
        pointerEvents="none"
        style={{
          minHeight: multiline || subtitle ? 68 : 56,
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}>
        {before ? <View style={{ flexShrink: 0, marginRight: 12 }}>{before}</View> : null}
        <View style={{ minWidth: 0, flex: 1 }}>
          {renderCopy(title, 'title', palette.ink)}
          {subtitle ? renderCopy(subtitle, 'subtitle', palette.inkSecondary) : null}
        </View>
        {after ? <View style={{ flexShrink: 0, marginLeft: 10 }}>{after}</View> : null}
        {chevron ? (
          <Animated.View style={[{ flexShrink: 0, marginLeft: after ? 6 : 10 }, chevronStyle]}>
            <AppIcon name="chevron-forward" size={18} color={palette.inkMuted} />
          </Animated.View>
        ) : null}
      </View>
    </PressableScale>
  );
}
