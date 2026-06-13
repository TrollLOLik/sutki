import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query';
import { useSessionStore } from '@/store/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useSessionStore((s) => s.status);
  const hydrate = useSessionStore((s) => s.hydrate);

  useEffect(() => {
    hydrate().finally(() => SplashScreen.hideAsync());
  }, [hydrate]);

  if (status === 'loading') return null;

  const authed = status === 'authenticated';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
            <Stack.Protected guard={authed}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="listing/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="booking/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={!authed}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
