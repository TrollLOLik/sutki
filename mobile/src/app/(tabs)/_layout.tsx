import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { palette } from '@/theme/tokens';

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(outline: IoniconName, filled: IoniconName) {
  return ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarStyle: { borderTopColor: palette.line, backgroundColor: palette.surface },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Поиск', tabBarIcon: tabIcon('search-outline', 'search') }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Карта', tabBarIcon: tabIcon('map-outline', 'map') }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: 'Избранное', tabBarIcon: tabIcon('heart-outline', 'heart') }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Сообщения', tabBarIcon: tabIcon('chatbubble-outline', 'chatbubble') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Профиль', tabBarIcon: tabIcon('person-outline', 'person') }}
      />
    </Tabs>
  );
}
