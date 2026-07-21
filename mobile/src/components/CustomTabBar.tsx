import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolateColor,
  interpolate,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarStore } from '@/store/tabbar';
import { useAppTheme } from '@/theme/useAppTheme';
import { requireAuth } from '@/lib/requireAuth';
import { useActivityCounters } from '@/lib/api/activity';
import { useSessionStore } from '@/store/session';
import { CreateListingButton } from '@/components/CreateListingButton';

export const TAB_BAR_HEIGHT = 58;
export const TAB_BAR_HORIZONTAL_MARGIN = 10;
export const TAB_BAR_SLOT_COUNT = 5;

export function getTabBarBottomOffset(safeAreaBottom: number) {
  return safeAreaBottom > 0 ? safeAreaBottom + 7 : 10;
}

export function getTabSlotCenterX(windowWidth: number, slotIndex: number) {
  const usableWidth = Math.max(0, windowWidth - TAB_BAR_HORIZONTAL_MARGIN * 2);
  return TAB_BAR_HORIZONTAL_MARGIN + (usableWidth / TAB_BAR_SLOT_COUNT) * (slotIndex + 0.5);
}

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabMeta {
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
}

const TAB_META: Record<string, TabMeta> = {
  index: { label: 'Поиск', icon: 'search-outline', activeIcon: 'search' },
  map: { label: 'Карта', icon: 'map-outline', activeIcon: 'map' },
  messages: { label: 'Сообщения', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
  profile: { label: 'Профиль', icon: 'person-outline', activeIcon: 'person' },
};

const LEFT_TABS = ['index', 'map'];
const RIGHT_TABS = ['messages', 'profile'];

/* ─────────────────────────── TabButton ─────────────────────────── */

interface TabButtonProps {
  focused: boolean;
  meta: TabMeta;
  onPress: () => void;
  reduceMotion: boolean;
  mapTransition: SharedValue<number>;
  badge?: number;
}

function TabButton({ focused, meta, onPress, reduceMotion, mapTransition, badge = 0 }: TabButtonProps) {
  const { palette, isDark } = useAppTheme();
  const focusAnim = useSharedValue(focused ? 1 : 0);
  const pressAnim = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      focusAnim.value = focused ? 1 : 0;
    } else {
      focusAnim.value = withSpring(focused ? 1 : 0, {
        damping: 15,
        stiffness: 150,
        mass: 0.8,
      });
    }
  }, [focused, reduceMotion]);

  const iconScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focusAnim.value * 0.07 }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressAnim.value }],
  }));

  const activeIconOpacity = useAnimatedStyle(() => ({
    opacity: focusAnim.value,
  }));

  const inactiveIconOpacity = useAnimatedStyle(() => ({
    opacity: 1 - focusAnim.value,
  }));

  const surfaceTransparent = `${palette.surface}00`;
  const lineTransparent = `${palette.line}00`;
  const cardStyle = useAnimatedStyle(() => {
    const size = 48;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: interpolateColor(
        mapTransition.value,
        [0, 0.5, 1],
        [surfaceTransparent, surfaceTransparent, palette.surface],
      ),
      borderWidth: interpolate(mapTransition.value, [0, 0.7, 1], [0, 0, 1]),
      borderColor: interpolateColor(
        mapTransition.value,
        [0, 0.7, 1],
        [lineTransparent, lineTransparent, palette.line],
      ),
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: interpolate(mapTransition.value, [0, 0.8, 1], [0, 0, 0.12]),
      shadowRadius: interpolate(mapTransition.value, [0, 0.8, 1], [0, 0, 6]),
      elevation: interpolate(mapTransition.value, [0, 0.8, 1], [0, 0, 3]),
    };
  });

  const activeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: focusAnim.value * (1 - mapTransition.value),
    transform: [{ scale: 0.88 + focusAnim.value * 0.12 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      onPressIn={() => {
        pressAnim.value = reduceMotion ? 0.96 : withTiming(0.92, { duration: 90 });
      }}
      onPressOut={() => {
        pressAnim.value = reduceMotion
          ? 1
          : withSpring(1, { damping: 18, stiffness: 320, mass: 0.7 });
      }}
      style={styles.tabSlot}>
      <Animated.View style={[styles.cardBase, cardStyle, pressStyle]}>
        <Animated.View
          style={[
            styles.activeIndicator,
            { backgroundColor: isDark ? 'rgba(255,107,53,0.17)' : palette.primaryLight },
            activeIndicatorStyle,
          ]}
        />
        <Animated.View style={[styles.iconWrap, iconScaleStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, inactiveIconOpacity]}>
            <Ionicons name={meta.icon} size={24} color={palette.inkMuted} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, activeIconOpacity]}>
            <Ionicons name={meta.activeIcon} size={24} color={palette.primary} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      {badge > 0 ? (
        <View style={[styles.badge, { borderColor: isDark ? '#181A1F' : '#FFFFFF' }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ──────────────────────── CustomTabBar ──────────────────────── */

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { palette, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const authenticated = useSessionStore((s) => s.status === 'authenticated');
  const { data: activity } = useActivityCounters(authenticated);

  /* ── routing helpers ── */
  const routeByName = Object.fromEntries(state.routes.map((r) => [r.name, r] as const));
  const activeName = state.routes[state.index]?.name;

  /* ── hide / show on scroll ── */
  const visible = useTabBarStore((s) => s.visible);
  const translateY = useSharedValue(0);

  useEffect(() => {
    useTabBarStore.getState().setVisible(true);
  }, [activeName]);

  useEffect(() => {
    translateY.value = reduceMotion
      ? visible ? 0 : 100 + insets.bottom
      : withTiming(visible ? 0 : 100 + insets.bottom, {
          duration: 250,
          easing: Easing.out(Easing.ease),
        });
  }, [visible, insets.bottom, reduceMotion]);

  /* ── map ↔ normal transition (spring for organic feel) ── */
  const isMap = activeName === 'map';
  const mapTransition = useSharedValue(isMap ? 1 : 0);

  useEffect(() => {
    mapTransition.value = reduceMotion
      ? isMap ? 1 : 0
      : withSpring(isMap ? 1 : 0, {
          damping: 22,
          stiffness: 200,
          mass: 0.8,
        });
  }, [isMap, reduceMotion]);

  /* ── container animated styles ── */
  const hideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const materialStyle = useAnimatedStyle(() => ({
    opacity: 1 - mapTransition.value,
  }));

  const shellStyle = useAnimatedStyle(() => ({
    minHeight: 58,
    borderWidth: interpolate(mapTransition.value, [0, 1], [StyleSheet.hairlineWidth, 0]),
    borderColor: interpolateColor(mapTransition.value, [0, 1], [
      isDark ? 'rgba(255,255,255,0.11)' : 'rgba(18,24,32,0.09)',
      'transparent',
    ]),
    shadowOpacity: interpolate(mapTransition.value, [0, 1], [isDark ? 0.3 : 0.14, 0]),
    elevation: interpolate(mapTransition.value, [0, 1], [10, 0]),
  }));

  /* ── render helper ── */
  const renderTab = (name: string) => {
    const route = routeByName[name];
    const meta = TAB_META[name];
    if (!route || !meta) return null;

    const routeIndex = state.routes.findIndex((r) => r.name === name);
    const focused = state.index === routeIndex;
    const badge = name === 'messages' ? activity?.messages ?? 0 : name === 'profile' ? activity?.notifications ?? 0 : 0;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <TabButton
        key={name}
        focused={focused}
        meta={meta}
        onPress={onPress}
        reduceMotion={reduceMotion}
        mapTransition={mapTransition}
        badge={badge}
      />
    );
  };

  /* ── JSX ── */
  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: getTabBarBottomOffset(insets.bottom) },
        hideStyle,
      ]}>
      <Animated.View style={[styles.shell, shellStyle]}>
        <Animated.View pointerEvents="none" style={[styles.materialClip, materialStyle]}>
          <BlurView
            intensity={88}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(24,26,31,0.76)' : 'rgba(255,255,255,0.76)' },
            ]}
          />
        </Animated.View>

        {LEFT_TABS.map(renderTab)}

        <View style={styles.tabSlot}>
          <CreateListingButton
            onPress={() => {
                if (requireAuth('listing')) {
                  router.push('/create');
                }
            }}
          />
        </View>

        {RIGHT_TABS.map(renderTab)}
      </Animated.View>
    </Animated.View>
  );
}

/* ──────────────────────────── Styles ──────────────────────────── */

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'visible',
  },
  shell: {
    flex: 1,
    marginHorizontal: TAB_BAR_HORIZONTAL_MARGIN,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 30,
    shadowColor: '#000000',
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'visible',
  },
  materialClip: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 30,
    overflow: 'hidden',
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 5,
  },
  cardBase: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 1,
    left: '55%',
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4D2E',
    borderWidth: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
});
