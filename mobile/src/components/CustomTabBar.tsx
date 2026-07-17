import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  interpolateColor,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarStore } from '@/store/tabbar';
import { useAppTheme } from '@/theme/useAppTheme';
import { requireAuth } from '@/lib/requireAuth';
import { useActivityCounters } from '@/lib/api/activity';
import { useSessionStore } from '@/store/session';

export const TAB_BAR_HEIGHT = 49;

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
  const { palette } = useAppTheme();
  const focusAnim = useSharedValue(focused ? 1 : 0);

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

  /* Icon scale on focus */
  const iconScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focusAnim.value * 0.12 }],
  }));

  const activeIconOpacity = useAnimatedStyle(() => ({
    opacity: focusAnim.value,
  }));

  const inactiveIconOpacity = useAnimatedStyle(() => ({
    opacity: 1 - focusAnim.value,
  }));

  const textColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focusAnim.value, [0, 1], [palette.inkMuted, palette.primary]),
  }));

  /*
   * Card: grows from 28 → 48 px, gains a themed surface background, border,
   * rounded corners, and shadow. Layout (flex: 1 on the slot) never
   * changes, so no janky reflows.
   */
  // Hex8 alpha variants of theme colors: interpolate from a fully transparent
  // version of the SAME hue (NOT 'transparent', which RN parses as
  // rgba(0,0,0,0) and produces a gray smear mid-transition).
  const surfaceTransparent = `${palette.surface}00`;
  const lineTransparent = `${palette.line}00`;
  const cardStyle = useAnimatedStyle(() => {
    const size = interpolate(mapTransition.value, [0, 1], [28, 48]);
    return {
      width: size,
      height: size,
      // Always a perfect circle — no square shape mid-transition
      borderRadius: size / 2,
      backgroundColor: interpolateColor(
        mapTransition.value,
        [0, 0.5, 1],
        [surfaceTransparent, surfaceTransparent, palette.surface],
      ),
      // Border fades in only in the final 30% of the transition
      borderWidth: interpolate(mapTransition.value, [0, 0.7, 1], [0, 0, 1]),
      borderColor: interpolateColor(
        mapTransition.value,
        [0, 0.7, 1],
        [lineTransparent, lineTransparent, palette.line],
      ),
      // Shadow appears only at the very end — no phantom squares mid-flight
      // (fixed near-black: a light ink shadow would glow in dark mode)
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: interpolate(mapTransition.value, [0, 0.8, 1], [0, 0, 0.12]),
      shadowRadius: interpolate(mapTransition.value, [0, 0.8, 1], [0, 0, 6]),
      elevation: interpolate(mapTransition.value, [0, 0.8, 1], [0, 0, 3]),
    };
  });

  /* Label fades & collapses in map mode */
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mapTransition.value, [0, 0.35], [1, 0]),
    maxHeight: interpolate(mapTransition.value, [0, 1], [16, 0]),
    marginTop: interpolate(mapTransition.value, [0, 1], [4, 0]),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      style={styles.tabSlot}>
      <Animated.View style={[styles.cardBase, cardStyle]}>
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
        <View style={[styles.badge, { borderColor: palette.surface }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.tabLabel,
          { fontWeight: focused ? '600' : '500' },
          textColorStyle,
          labelStyle,
        ]}>
        {meta.label}
      </Animated.Text>
    </Pressable>
  );
}

/* ──────────────────────── CustomTabBar ──────────────────────── */

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const authenticated = useSessionStore((s) => s.status === 'authenticated');
  const { data: activity } = useActivityCounters(authenticated);

  const pulse = useSharedValue(0);
  const rotation = useSharedValue(0);
  const centerScale = useSharedValue(1);
  const centerRotate = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Gradient background: steady linear spin
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
    // Pulse ring: ease-out expansion, then jump back
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
    // Shimmer: smooth ease-in-out that reverses seamlessly
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.ease }),
      -1,
      true, // ← reverse: ping-pong so there's no jump
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.35 }],
    opacity: 0.6 * (1 - pulse.value),
  }));

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Scale wraps the whole button — spring for organic bounce
  const centerScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }],
  }));

  // Rotation applied ONLY to the "+" icon glyph
  const centerRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${centerRotate.value}deg` }],
  }));

  // Shimmer beam travels across the circle diagonally
  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [0, 1], [-60, 60]);
    return {
      transform: [{ translateX }, { rotate: '30deg' }],
    };
  });

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
    translateY.value = withTiming(visible ? 0 : 100 + insets.bottom, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
  }, [visible, insets.bottom]);

  /* ── map ↔ normal transition (spring for organic feel) ── */
  const isMap = activeName === 'map';
  const mapTransition = useSharedValue(isMap ? 1 : 0);

  useEffect(() => {
    mapTransition.value = withSpring(isMap ? 1 : 0, {
      damping: 22,
      stiffness: 200,
      mass: 0.8,
    });
  }, [isMap]);

  /* ── container animated styles ── */
  const hideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const containerBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      mapTransition.value,
      [0, 1],
      [palette.surface, 'transparent'],
    ),
  }));

  const containerBorderStyle = useAnimatedStyle(() => ({
    borderTopWidth: interpolate(mapTransition.value, [0, 1], [1, 0]),
    borderTopColor: interpolateColor(
      mapTransition.value,
      [0, 1],
      [palette.line, 'transparent'],
    ),
  }));

  /* Center "+" lift animation */
  const centerLiftStyle = useAnimatedStyle(() => ({
    marginTop: interpolate(mapTransition.value, [0, 1], [-18, 0]),
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
        { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
        hideStyle,
        containerBgStyle,
        containerBorderStyle,
      ]}>

      {LEFT_TABS.map(renderTab)}

      {/* Center "+" — animated create-listing action */}
      <View style={styles.tabSlot}>
        <Animated.View style={centerLiftStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Разместить объявление"
            onPressIn={() => {
              // Spring-in: quick compress with slight overshoot on release
              centerScale.value = withSpring(0.88, { damping: 20, stiffness: 400 });
              centerRotate.value = withSpring(45, { damping: 20, stiffness: 400 });
            }}
            onPressOut={() => {
              // Bouncy spring-back
              centerScale.value = withSpring(1, { damping: 12, stiffness: 250 });
              centerRotate.value = withSpring(0, { damping: 12, stiffness: 250 });
            }}
            onPress={() => {
              if (requireAuth('listing')) {
                router.push('/create');
              }
            }}
            style={styles.centerBtn}>

            {/* Layer 1: Pulse ring — fully independent */}
            <Animated.View style={[styles.pulseBg, pulseStyle]} />

            {/* Layer 2: Main circle — spring-scales on press */}
            <Animated.View style={[styles.gradientWrap, centerScaleStyle]}>

              {/* Layer 3: Spinning gradient — always runs, clips to circle */}
              <Animated.View style={[styles.gradientOversize, rotationStyle]}>
                <LinearGradient
                  colors={['#FF8E53', '#FF5A1F', '#FF2D55', '#FF8E53']}
                  start={{ x: 0.0, y: 0.0 }}
                  end={{ x: 1.0, y: 1.0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              {/* Layer 4: Shimmer beam — ping-pongs horizontally */}
              <Animated.View style={[styles.shimmerBeam, shimmerStyle]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              {/* Layer 5: Icon — rotates on press ONLY, nothing else */}
              <Animated.View style={centerRotateStyle}>
                <Ionicons name="add" size={28} color="#FFFFFF" />
              </Animated.View>

            </Animated.View>
          </Pressable>
        </Animated.View>
      </View>

      {RIGHT_TABS.map(renderTab)}
    </Animated.View>
  );
}

/* ──────────────────────────── Styles ──────────────────────────── */

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'visible',
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  cardBase: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  tabLabel: {
    fontSize: 11,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 2,
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
  centerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The center "+" sits on a fixed brand-orange gradient (#FF8E53→#FF5A1F→
  // #FF2D55) that is intentionally NOT themed, so these use the brand
  // constant rather than the theme palette.
  pulseBg: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF5A1F',
  },
  // overflow:'hidden' clips the spinning gradient AND shimmer to the circle
  // Shadow must live on a separate wrapper outside the clipping view (iOS)
  gradientWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF5A1F',
    shadowColor: '#FF5A1F',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientOversize: {
    position: 'absolute',
    width: 80,
    height: 80,
    top: -16,
    left: -16,
  },
  // Shimmer beam: a narrow strip that ping-pongs across the circle
  shimmerBeam: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 22,
  },
});
