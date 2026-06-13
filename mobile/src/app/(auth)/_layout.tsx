import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerTintColor: '#1A1A1A',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="phone" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="code" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="profile-setup" options={{ headerShown: true, title: 'Создание профиля' }} />
    </Stack>
  );
}
