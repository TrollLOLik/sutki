import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/theme/tokens';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabMeta {
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
}

// Metadata for the four real tabs. The center "+" (create listing) is injected
// between the two groups and is not a real tab route — tapping it opens the
// create-listing modal instead of switching tabs.
const TAB_META: Record<string, TabMeta> = {
  index: { label: 'Поиск', icon: 'search-outline', activeIcon: 'search' },
  map: { label: 'Карта', icon: 'map-outline', activeIcon: 'map' },
  messages: { label: 'Сообщения', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
  profile: { label: 'Профиль', icon: 'person-outline', activeIcon: 'person' },
};

const LEFT_TABS = ['index', 'map'];
const RIGHT_TABS = ['messages', 'profile'];

/**
 * Custom bottom tab bar with a raised, animated center "+" button (TikTok
 * style) that opens the create-listing flow. Избранное is no longer a tab — it
 * lives as a heart filter on the home screen — so the bar shows four tabs split
 * around the central action button.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [pressed, setPressed] = useState(false);

  const pulse = useSharedValue(0);
  const rotation = useSharedValue(0);

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

  const renderTab = (name: string) => {
    const route = routeByName[name];
    const meta = TAB_META[name];
    if (!route || !meta) return null;
    const focused = activeName === name;
    const color = focused ? palette.primary : palette.inkMuted;

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
      <Pressable
        key={name}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        onPress={onPress}
        className="flex-1 items-center justify-end gap-1 pt-2 active:opacity-70">
        <Ionicons name={focused ? meta.activeIcon : meta.icon} size={24} color={color} />
        <Text style={{ fontSize: 11, fontWeight: '500', color }}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className="flex-row items-end border-t border-line bg-surface pb-1">
      {LEFT_TABS.map(renderTab)}

      {/* Center "+" — raised, animated create-listing action */}
      <View className="flex-1 items-center justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Разместить объявление"
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          onPress={() => router.push('/create')}
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
    </View>
  );
}
