import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { type StyleProp, Vibration, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigationMenuTop } from '@/components/NavigationHistoryOverlay';
import { goBackOrReplace } from '@/lib/navigation';
import { NAVIGATION_MENU_ROW_HEIGHT, useNavigationHistoryStore } from '@/store/navigation-history';
import { useAppTheme } from '@/theme/useAppTheme';

const MENU_HEADER_HEIGHT = 34;
const MENU_LEFT = 12;
const MENU_WIDTH = 286;
const ROOT_TAB_PATHS = new Set(['/', '/map', '/messages', '/profile']);

interface NavigationBackButtonProps {
  accessibilityLabel?: string;
  children?: ReactNode;
  className?: string;
  fallback?: Href;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  variant?: 'plain' | 'material';
}

export function NavigationBackButton({
  accessibilityLabel = 'Назад',
  children,
  className = 'h-11 w-11 items-center justify-center rounded-full',
  fallback = '/(tabs)',
  onPress,
  size = 44,
  style,
  variant = 'plain',
}: NavigationBackButtonProps) {
  const { palette, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const handlePress = useCallback(() => {
    if (onPress) onPress();
    else goBackOrReplace(fallback);
  }, [fallback, onPress]);

  const openHistory = useCallback(() => {
    const store = useNavigationHistoryStore.getState();
    store.openMenu();
    if (useNavigationHistoryStore.getState().menuOpen) Vibration.vibrate(12);
  }, []);

  const updateSelection = useCallback(
    (absoluteX: number, absoluteY: number) => {
      const store = useNavigationHistoryStore.getState();
      if (!store.menuOpen) return;

      const rowsTop = navigationMenuTop(insets.top) + MENU_HEADER_HEIGHT;
      const index = Math.floor((absoluteY - rowsTop) / NAVIGATION_MENU_ROW_HEIGHT);
      const insideMenuX = absoluteX >= MENU_LEFT && absoluteX <= MENU_LEFT + MENU_WIDTH;
      const nextIndex = insideMenuX && index >= 0 && index < store.menuEntries.length ? index : null;
      if (nextIndex !== store.selectedIndex) {
        store.selectIndex(nextIndex);
        if (nextIndex != null) Vibration.vibrate(7);
      }
    },
    [insets.top],
  );

  const commitSelection = useCallback(() => {
    const store = useNavigationHistoryStore.getState();
    const entry = store.selectedIndex == null ? null : store.menuEntries[store.selectedIndex];
    store.closeMenu();
    if (!entry) return;
    store.truncateTo(entry.key);
    if (typeof entry.href === 'string' && ROOT_TAB_PATHS.has(entry.href)) {
      if (router.canDismiss()) router.dismissAll();
      router.navigate(entry.href);
    } else {
      router.dismissTo(entry.href);
    }
  }, []);

  const cancelSelection = useCallback(() => {
    useNavigationHistoryStore.getState().closeMenu();
  }, []);

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(420)
        .maxDistance(1000)
        .shouldCancelWhenOutside(false)
        .onStart(() => runOnJS(openHistory)())
        .onTouchesMove((event) => {
          const touch = event.allTouches[0];
          if (touch) runOnJS(updateSelection)(touch.absoluteX, touch.absoluteY);
        })
        .onEnd(() => runOnJS(commitSelection)())
        .onFinalize((_event, success) => {
          if (!success) runOnJS(cancelSelection)();
        }),
    [cancelSelection, commitSelection, openHistory, updateSelection],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((_event, success) => {
        if (success) runOnJS(handlePress)();
      }),
    [handlePress],
  );

  const gesture = useMemo(
    () => Gesture.Exclusive(longPressGesture, tapGesture),
    [longPressGesture, tapGesture],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        className={className}
        onAccessibilityTap={handlePress}
        style={[
          variant === 'material'
            ? {
                width: size,
                height: size,
                borderRadius: size / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#202329' : '#F0F1F3',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,24,32,0.07)',
              }
            : null,
          style,
        ]}>
        {children ?? <Ionicons name="chevron-back" size={24} color={palette.ink} />}
      </View>
    </GestureDetector>
  );
}
