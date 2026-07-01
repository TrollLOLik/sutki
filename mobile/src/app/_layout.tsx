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
import { palette } from '@/theme/tokens';
import { useAuthGateStore } from '@/lib/requireAuth';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { YamapInstance } from 'react-native-yamap-plus';

// Initialize Yandex Maps SDK on JS startup to prevent native crashes.
YamapInstance.init(process.env.EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY || '');

SplashScreen.preventAutoHideAsync();




export default function RootLayout() {
  const status = useSessionStore((s) => s.status);
  const hydrate = useSessionStore((s) => s.hydrate);
  const { visible, context, closeGate } = useAuthGateStore();

  useEffect(() => {
    hydrate().finally(() => SplashScreen.hideAsync());
  }, [hydrate]);

  if (status === 'loading') return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.surface } }}>
            <Stack.Protected guard={status === 'authenticated' || status === 'guest'}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="listing/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
              <Stack.Screen name="booking/[id]" />
              <Stack.Screen name="bookings/index" />
              <Stack.Screen name="bookings/[id]" />
              <Stack.Screen name="incoming/index" />
              <Stack.Screen name="incoming/[id]" />
              <Stack.Screen name="create" options={{ presentation: 'modal' }} />
              <Stack.Screen name="my-listings/index" />
            </Stack.Protected>
            {/* Tokens are set but the profile is incomplete: the (auth) stack is
                unmounted and only profile-setup is reachable until onboarding
                completes. This also covers a cold start mid-onboarding. */}
            <Stack.Protected guard={status === 'onboarding'}>
              <Stack.Screen name="profile-setup" />
            </Stack.Protected>
            <Stack.Protected guard={status === 'unauthenticated' || status === 'guest'}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
          <AuthGateSheet visible={visible} onClose={closeGate} context={context} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
