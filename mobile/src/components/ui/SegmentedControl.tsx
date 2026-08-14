import { useEffect, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { selectionMotion } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: AppIconName;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T, origin?: { x: number; y: number }) => void;
  accessibilityLabel?: string;
  variant?: 'grouped' | 'separate';
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel = 'Переключатель',
  variant = 'grouped',
  style,
}: SegmentedControlProps<T>) {
  const { palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const activeIndex = useSharedValue(selectedIndex);
  const separate = variant === 'separate';
  const gap = separate ? 6 : 4;
  const horizontalPadding = separate ? 0 : 4;
  const itemWidth = options.length > 0
    ? Math.max(
        0,
        (containerWidth - horizontalPadding * 2 - gap * (options.length - 1)) / options.length,
      )
    : 0;

  useEffect(() => {
    activeIndex.value = reduceMotion
      ? selectedIndex
      : withSpring(selectedIndex, selectionMotion.spring);
  }, [activeIndex, reduceMotion, selectedIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: itemWidth,
    transform: [{ translateX: activeIndex.value * (itemWidth + gap) }],
  }), [gap, itemWidth]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={[
        {
          width: '100%',
          alignSelf: 'stretch',
          minHeight: separate ? 44 : 50,
          flexDirection: 'row',
          gap,
          borderRadius: separate ? 14 : 16,
          backgroundColor: separate ? 'transparent' : palette.surfaceMuted,
          padding: horizontalPadding,
        },
        style,
      ]}>
      {separate && itemWidth > 0
        ? options.map((option, index) => (
            <View
              key={`surface-${option.value}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: itemWidth,
                height: 44,
                transform: [{ translateX: index * (itemWidth + gap) }],
                borderRadius: 14,
                borderWidth: 1,
                borderColor: palette.line,
                backgroundColor: palette.surface,
              }}
            />
          ))
        : null}
      {itemWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: separate ? 0 : 4,
              bottom: separate ? 0 : 4,
              left: horizontalPadding,
              borderRadius: separate ? 14 : 13,
              borderWidth: 1,
              borderColor: separate ? palette.primary : palette.line,
              backgroundColor: separate ? palette.primaryLight : palette.surface,
              zIndex: 1,
            },
            indicatorStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: Boolean(option.disabled) }}
            disabled={Boolean(option.disabled)}
            motionVariant="control"
            pressedScale={0.985}
            disabledOpacity={0.4}
            onPress={(event) =>
              onChange(option.value, {
                x: event.nativeEvent.pageX,
                y: event.nativeEvent.pageY,
              })
            }
            style={{
              minWidth: 0,
              flexBasis: 0,
              flexGrow: 1,
              flexShrink: 1,
              zIndex: 2,
            }}>
            <View
              pointerEvents="none"
              style={{
                minHeight: 42,
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderRadius: separate ? 14 : 13,
                borderWidth: 0,
                backgroundColor: 'transparent',
              }}>
              {option.icon ? (
                <AppIcon
                  name={option.icon}
                  size={16}
                  color={selected ? palette.primary : palette.inkSecondary}
                />
              ) : null}
              <AppText
                variant="captionStrong"
                tone={selected && separate ? 'primary' : selected ? 'ink' : 'secondary'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  minWidth: 0,
                  flexShrink: 1,
                  fontSize: separate ? 12 : 13,
                  fontWeight: selected ? '800' : '600',
                }}>
                {option.label}
              </AppText>
              {option.badge}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
