import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/useAppTheme';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

export default function AuthLayout() {
  const { palette } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerTintColor: palette.ink,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: palette.surface },
      }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="email" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="code" options={{ headerShown: true, title: '' }} />
    </Stack>
  );
}
