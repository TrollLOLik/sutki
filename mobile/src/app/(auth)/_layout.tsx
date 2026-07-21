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
        animation: 'slide_from_right',
        gestureEnabled: true,
        contentStyle: { backgroundColor: palette.surface },
      }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="email" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="code" />
    </Stack>
  );
}
