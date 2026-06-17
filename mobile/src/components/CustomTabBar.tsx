import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
          style={{ marginTop: -22 }}
          className="items-center justify-center">
          <MotiView
            animate={{ scale: pressed ? 0.86 : 1, rotate: pressed ? '90deg' : '0deg' }}
            transition={{ type: 'timing', duration: 160 }}
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.primary,
              shadowColor: palette.primary,
              shadowOpacity: 0.4,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}>
            <Ionicons name="add" size={34} color="#FFFFFF" />
          </MotiView>
        </Pressable>
      </View>

      {RIGHT_TABS.map(renderTab)}
    </View>
  );
}
