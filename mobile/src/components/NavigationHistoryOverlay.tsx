import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  FadeOutUp,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  NAVIGATION_MENU_ROW_HEIGHT,
  type NavigationHistoryEntry,
  useNavigationHistoryStore,
} from '@/store/navigation-history';
import { useAppTheme } from '@/theme/useAppTheme';

export const navigationMenuTop = (safeTop: number) => safeTop + 54;

function HistoryRow({ entry, index, selected }: { entry: NavigationHistoryEntry; index: number; selected: boolean }) {
  const { palette } = useAppTheme();
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, {
      duration: 130,
      easing: Easing.out(Easing.quad),
    });
  }, [progress, selected]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [`${palette.primaryLight}00`, palette.primaryLight],
    ),
  }));

  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 - progress.value * 0.08 }],
  }));

  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.88 + progress.value * 0.24 }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [palette.ink, palette.primary]),
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 28).duration(170)}
      layout={LinearTransition.duration(140)}
      style={[styles.row, { height: NAVIGATION_MENU_ROW_HEIGHT }, rowStyle]}>
      <View style={styles.iconFrame}>
        <Animated.View style={[styles.iconLayer, inactiveIconStyle]}>
          <Ionicons name="ellipse-outline" size={22} color={palette.inkMuted} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, activeIconStyle]}>
          <Ionicons name="arrow-back-circle" size={22} color={palette.primary} />
        </Animated.View>
      </View>
      <Animated.Text numberOfLines={1} style={[styles.title, titleStyle]}>
        {entry.title}
      </Animated.Text>
    </Animated.View>
  );
}

export function NavigationHistoryOverlay() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const open = useNavigationHistoryStore((state) => state.menuOpen);
  const entries = useNavigationHistoryStore((state) => state.menuEntries);
  const selectedIndex = useNavigationHistoryStore((state) => state.selectedIndex);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {open ? (
        <>
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(130)} style={styles.scrim} />
          <Animated.View
            entering={FadeInDown.duration(190).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutUp.duration(140)}
            style={[
              styles.menu,
              {
                backgroundColor: palette.surface,
                borderColor: palette.line,
                top: navigationMenuTop(insets.top),
              },
            ]}>
            <Text style={[styles.heading, { color: palette.inkMuted }]}>Вернуться к экрану</Text>
            {entries.map((entry, index) => (
              <HistoryRow
                key={`${entry.key}-${index}`}
                entry={entry}
                index={index}
                selected={index === selectedIndex}
              />
            ))}
            <Text style={[styles.hint, { color: palette.inkMuted }]}>Не отпуская палец, выберите экран</Text>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  menu: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 14,
    left: 12,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    width: 286,
  },
  heading: {
    height: 34,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  iconFrame: {
    height: 22,
    width: 22,
  },
  iconLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hint: {
    fontSize: 11,
    paddingBottom: 11,
    paddingHorizontal: 14,
    paddingTop: 5,
  },
});
