import { useEffect, useState } from 'react';
import { ScrollView, View, type LayoutRectangle } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSelectionProgress } from '@/components/ui/useSelectionProgress';
import { selectionMotion } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export interface CountedTabItem<T extends string> {
  value: T;
  label: string;
  count: number;
  disabled?: boolean;
}

export interface CountedTabsProps<T extends string> {
  items: readonly CountedTabItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

interface CountedTabButtonProps<T extends string> {
  item: CountedTabItem<T>;
  selected: boolean;
  stretched: boolean;
  onChange: (value: T) => void;
  onLayout: (value: T, layout: LayoutRectangle) => void;
}

function CountedTabButton<T extends string>({
  item,
  selected,
  stretched,
  onChange,
  onLayout,
}: CountedTabButtonProps<T>) {
  const { palette } = useAppTheme();
  const selection = useSelectionProgress(selected);
  const surfaceStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      selection.value,
      [0, 1],
      [palette.line, palette.primary],
    ),
    backgroundColor: interpolateColor(
      selection.value,
      [0, 1],
      [palette.surface, palette.primaryLight],
    ),
  }));
  const countStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selection.value,
      [0, 1],
      [palette.surfaceMuted, palette.primary],
    ),
    transform: [{ scale: interpolate(selection.value, [0, 1], [1, 1.06]) }],
  }));

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={`${item.label}: ${item.count}`}
      accessibilityState={{ selected, disabled: Boolean(item.disabled) }}
      disabled={Boolean(item.disabled)}
      motionVariant="control"
      pressedScale={0.98}
      disabledOpacity={0.42}
      onPress={() => onChange(item.value)}
      onLayout={(event) => onLayout(item.value, event.nativeEvent.layout)}
      style={{
        minHeight: 38,
        minWidth: 0,
        flexBasis: stretched ? 0 : undefined,
        flexGrow: stretched ? 1 : 0,
        flexShrink: stretched ? 1 : 0,
        borderRadius: 19,
        zIndex: 2,
      }}>
      <Animated.View
        style={[
          {
            minHeight: 38,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            borderRadius: 19,
            borderWidth: 1,
            paddingHorizontal: 13,
          },
          stretched ? { width: '100%' } : null,
          surfaceStyle,
        ]}>
        <AppText
          variant="captionStrong"
          tone={selected ? 'primary' : 'secondary'}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          style={{
            minWidth: 0,
            flexShrink: 1,
            fontSize: 13,
            fontWeight: '700',
          }}>
          {item.label}
        </AppText>
        <Animated.View
          style={[
            {
              minWidth: 22,
              height: 22,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              paddingHorizontal: 5,
            },
            countStyle,
          ]}>
          <AppText
            variant="captionStrong"
            tone={selected ? 'inverse' : 'muted'}
            style={{ fontSize: 11, lineHeight: 14, fontWeight: '800' }}>
            {item.count > 99 ? '99+' : item.count}
          </AppText>
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

interface CountedTabsContentProps<T extends string> extends CountedTabsProps<T> {
  stretched: boolean;
}

function CountedTabsContent<T extends string>({
  items,
  value,
  onChange,
  stretched,
}: CountedTabsContentProps<T>) {
  const { palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const indicatorX = useSharedValue(0);
  const indicatorY = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorHeight = useSharedValue(38);
  const indicatorOpacity = useSharedValue(0);
  const selectedLayout = value == null ? undefined : layouts[value];

  useEffect(() => {
    if (!selectedLayout) {
      indicatorOpacity.value = withTiming(0, { duration: 100 });
      return;
    }

    if (reduceMotion || indicatorOpacity.value === 0) {
      indicatorX.value = selectedLayout.x;
      indicatorY.value = selectedLayout.y;
      indicatorWidth.value = selectedLayout.width;
      indicatorHeight.value = selectedLayout.height;
    } else {
      indicatorX.value = withSpring(selectedLayout.x, selectionMotion.spring);
      indicatorY.value = withSpring(selectedLayout.y, selectionMotion.spring);
      indicatorWidth.value = withSpring(selectedLayout.width, selectionMotion.spring);
      indicatorHeight.value = withSpring(selectedLayout.height, selectionMotion.spring);
    }
    indicatorOpacity.value = withTiming(1, { duration: reduceMotion ? 0 : 120 });
  }, [
    indicatorHeight,
    indicatorOpacity,
    indicatorWidth,
    indicatorX,
    indicatorY,
    reduceMotion,
    selectedLayout,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    height: indicatorHeight.value,
    opacity: indicatorOpacity.value,
    transform: [
      { translateX: indicatorX.value },
      { translateY: indicatorY.value },
    ],
  }));

  const handleLayout = (itemValue: T, layout: LayoutRectangle) => {
    setLayouts((current) => {
      const previous = current[itemValue];
      if (
        previous
        && previous.x === layout.x
        && previous.y === layout.y
        && previous.width === layout.width
        && previous.height === layout.height
      ) {
        return current;
      }
      return { ...current, [itemValue]: layout };
    });
  };

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 3,
            borderRadius: 19,
            borderWidth: 1,
            borderColor: palette.primary,
            backgroundColor: 'transparent',
          },
          indicatorStyle,
        ]}
      />
      {items.map((item) => (
        <CountedTabButton
          key={item.value}
          item={item}
          selected={item.value === value}
          stretched={stretched}
          onChange={onChange}
          onLayout={handleLayout}
        />
      ))}
    </>
  );
}

export function CountedTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel = 'Разделы',
}: CountedTabsProps<T>) {
  const stretchTabs = items.length <= 3;

  if (stretchTabs) {
    return (
      <View
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        style={{
          width: '100%',
          height: 54,
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          position: 'relative',
        }}>
        <CountedTabsContent items={items} value={value} onChange={onChange} stretched />
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      showsHorizontalScrollIndicator={false}
      style={{ width: '100%', height: 54, flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        position: 'relative',
      }}>
      <CountedTabsContent items={items} value={value} onChange={onChange} stretched={false} />
    </ScrollView>
  );
}
