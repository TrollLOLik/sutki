import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useThemeStore } from '@/store/theme';
import { darkPalette, lightPalette } from '@/theme/tokens';

// Pre-compute the radius needed to cover the farthest screen corner.
const { width: W, height: H } = Dimensions.get('screen');
const MAX_RADIUS = Math.ceil(Math.sqrt(W * W + H * H));
const CIRCLE_SIZE = MAX_RADIUS * 2;

/**
 * Full-screen circular-reveal overlay. Mounted in the root layout above
 * everything (including the tab bar) and driven purely by the theme store.
 *
 * Uses zero new native dependencies — only Reanimated (already in project).
 *
 * Animation sequence on each theme switch:
 *   1. Circle at `origin` scales 0 → 1 in 480 ms (cubic ease-out).
 *      The new theme renders silently underneath.
 *   2. Circle fades out in 220 ms, revealing the fully-rendered new theme.
 *   3. endThemeTransition() is called, unmounting the overlay.
 *
 * Circle color = new theme's surface, so the reveal feels like the new
 * theme "painting" over the old one.
 */
export function ThemeTransitionOverlay() {
  const transition = useThemeStore((s) => s.transition);
  const endThemeTransition = useThemeStore((s) => s.endThemeTransition);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!transition.active) {
      scale.value = 0;
      opacity.value = 0;
      return;
    }

    // Hard-reset before each new animation so rapid taps never stack.
    scale.value = 0;
    opacity.value = 1;

    scale.value = withTiming(
      1,
      { duration: 480, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (!finished) return;
        opacity.value = withTiming(
          0,
          { duration: 220, easing: Easing.in(Easing.quad) },
          (done) => {
            if (done) runOnJS(endThemeTransition)();
          },
        );
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition.active]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!transition.active || !transition.origin) return null;

  // Pick circle color matching the new theme's surface for a seamless reveal.
  const circleColor =
    transition.targetPreference === 'dark'
      ? darkPalette.surface
      : transition.targetPreference === 'light'
        ? lightPalette.surface
        : '#FF5A1F'; // 'system' — can't know direction, use brand orange

  const { x, y } = transition.origin;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: MAX_RADIUS,
            backgroundColor: circleColor,
            left: x - MAX_RADIUS,
            top: y - MAX_RADIUS,
          },
          circleStyle,
        ]}
      />
    </View>
  );
}
