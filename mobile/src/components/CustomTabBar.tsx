import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarStore } from '@/store/tabbar';
import { palette } from '@/theme/tokens';
import { requireAuth } from '@/lib/requireAuth';

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

interface TabButtonProps {
  focused: boolean;
  meta: TabMeta;
  onPress: () => void;
  reduceMotion: boolean;
}

function TabButton({ focused, meta, onPress, reduceMotion }: TabButtonProps) {
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

  const animatedStyle = useAnimatedStyle(() => {
    const scale = 1 + focusAnim.value * 0.12;
    
    return {
      transform: [{ scale }],
    };
  });

  const activeIconStyle = useAnimatedStyle(() => {
    return {
      opacity: focusAnim.value,
    };
  });

  const inactiveIconStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - focusAnim.value,
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      focusAnim.value,
      [0, 1],
      [palette.inkMuted, palette.primary]
    );

    return {
      color,
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      className="flex-1 items-center justify-end gap-1 pt-2 pb-1 active:opacity-70">
      <Animated.View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, inactiveIconStyle]}>
          <Ionicons name={meta.icon} size={24} color={palette.inkMuted} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, activeIconStyle]}>
          <Ionicons name={meta.activeIcon} size={24} color={palette.primary} />
        </Animated.View>
      </Animated.View>
      <Animated.Text
        style={[
          { fontSize: 11, fontWeight: focused ? '600' : '500' },
          textStyle,
        ]}>
        {meta.label}
      </Animated.Text>
    </Pressable>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [pressed, setPressed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const pulse = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.35 }],
    opacity: 0.6 * (1 - pulse.value),
  }));

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const routeByName = Object.fromEntries(state.routes.map((r) => [r.name, r] as const));
  const activeName = state.routes[state.index]?.name;

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

  const tabBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const renderTab = (name: string) => {
    const route = routeByName[name];
    const meta = TAB_META[name];
    if (!route || !meta) return null;

    const routeIndex = state.routes.findIndex((r) => r.name === name);
    const focused = state.index === routeIndex;

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
      />
    );
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom,
        },
        tabBarStyle,
      ]}
      className="flex-row items-end border-t border-line bg-surface pb-1">

      {LEFT_TABS.map(renderTab)}

      {/* Center "+" — raised, animated create-listing action */}
      <View className="flex-1 items-center justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Разместить объявление"
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          onPress={() => {
            if (requireAuth('listing')) {
              router.push('/create');
            }
          }}
          style={{ marginTop: -18 }}
          className="items-center justify-center">
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: palette.primary,
              },
              pulseStyle,
            ]}
          />
          <MotiView
            animate={{ scale: pressed ? 0.86 : 1 }}
            transition={{ type: 'timing', duration: 160 }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              shadowColor: palette.primary,
              shadowOpacity: 0.4,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 6,
            }}>
            <MotiView
              animate={{ rotate: pressed ? '90deg' : '0deg' }}
              transition={{ type: 'timing', duration: 160 }}
              style={{
                flex: 1,
                borderRadius: 24,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 76,
                    height: 76,
                    top: -14,
                    left: -14,
                  },
                  rotationStyle,
                ]}>
                <LinearGradient
                  colors={['#FF8E53', '#FF5A1F', '#FF2D55', '#FF8E53']}
                  start={{ x: 0.0, y: 0.0 }}
                  end={{ x: 1.0, y: 1.0 }}
                  style={{
                    flex: 1,
                  }}
                />
              </Animated.View>
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </MotiView>
          </MotiView>
        </Pressable>
      </View>

      {RIGHT_TABS.map(renderTab)}
    </Animated.View>
  );
}
