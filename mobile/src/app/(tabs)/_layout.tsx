import { Tabs, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { CustomTabBar } from '@/components/CustomTabBar';
import { SwipeableTabScene } from '@/components/SwipeableTabScene';
import { useTabBarStore } from '@/store/tabbar';
import { useAppTheme } from '@/theme/useAppTheme';

export default function TabsLayout() {
  const { palette } = useAppTheme();

  useFocusEffect(
    useCallback(() => {
      useTabBarStore.getState().setVisible(true);
    }, []),
  );

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenLayout={({ children, route, navigation }) => (
        <SwipeableTabScene
          routeName={route.name}
          navigate={(name) => navigation.navigate(name)}>
          {children}
        </SwipeableTabScene>
      )}
      screenOptions={{
        animation: 'shift',
        headerShown: false,
        sceneStyle: { backgroundColor: palette.surface },
        tabBarStyle: { position: 'absolute' },
        transitionSpec: {
          animation: 'timing',
          config: { duration: 220 },
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Поиск' }} />
      <Tabs.Screen name="map" options={{ title: 'Карта' }} />
      <Tabs.Screen name="messages" options={{ title: 'Сообщения' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
    </Tabs>
  );
}
