import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';

import { queryClient } from '@/lib/query';
import { useSessionStore } from '@/store/session';
import { useThemeStore } from '@/store/theme';
import { useAppTheme } from '@/theme/useAppTheme';
import { darkVars, lightVars } from '@/theme/vars';
import { useAuthGateStore } from '@/lib/requireAuth';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { ThemeTransitionOverlay } from '@/components/ThemeTransitionOverlay';
import { YamapInstance } from 'react-native-yamap-plus';
import { useNavigationRecovery } from '@/hooks/useNavigationRecovery';

export const unstable_settings = {
  anchor: '(tabs)',
};

const glitchTipDSN = process.env.EXPO_PUBLIC_GLITCHTIP_DSN;

Sentry.init({
  dsn: glitchTipDSN,
  enabled: Boolean(glitchTipDSN),
  environment: __DEV__ ? 'development' : 'production',
  sendDefaultPii: false,
  enableAutoSessionTracking: false,
  tracesSampleRate: 0,
});

// Initialize Yandex Maps SDK on JS startup to prevent native crashes.
const initYamap = async () => {
  try {
    await YamapInstance.setLocale('ru_RU');
    await YamapInstance.init(process.env.EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY || '');
  } catch (err) {
    console.warn('Yamap already initialized or failed to initialize:', err);
  }
};
initYamap();

SplashScreen.preventAutoHideAsync();




function RootLayout() {
  const status = useSessionStore((s) => s.status);
  const hydrate = useSessionStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const themeHydrated = useThemeStore((s) => s.hasHydrated);
  const { visible, context, closeGate } = useAuthGateStore();
  const { isDark, palette } = useAppTheme();
  useNavigationRecovery();

  useEffect(() => {
    // Theme must hydrate before the splash hides, otherwise a saved dark
    // preference would flash a light frame on cold start.
    Promise.all([hydrate(), hydrateTheme()]).finally(() => SplashScreen.hideAsync());
  }, [hydrate, hydrateTheme]);

  if (status === 'loading' || !themeHydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Root theme scope: applies the CSS variable set that every Tailwind
          color class resolves against (NativeWind native theming). */}
      <View style={[{ flex: 1 }, isDark ? darkVars : lightVars]}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.surface },
              animation: 'slide_from_right',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              fullScreenGestureEnabled: true,
            }}>
            <Stack.Protected guard={status === 'authenticated' || status === 'guest'}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="listing/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="listing/[id]/location" />
              <Stack.Screen name="listing/[id]/promote" />
              <Stack.Screen name="profile/[id]" />
              <Stack.Screen name="chat/[id]" />
              <Stack.Screen name="reviews/[id]" />
              <Stack.Screen name="review/[id]" />
              <Stack.Screen name="my-reviews" />
              <Stack.Screen name="filters" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="booking/[id]" />
              <Stack.Screen name="bookings/index" />
              <Stack.Screen name="bookings/[id]" />
              <Stack.Screen name="incoming/index" />
              <Stack.Screen name="incoming/[id]" />
              <Stack.Screen name="create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="my-listings/index" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="payments/checkout" />
              <Stack.Screen name="payments/return" />
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
      </View>
      {/* Circular-reveal overlay: above everything including tab bar and status
          bar. pointerEvents="none" so it never blocks touches. */}
      <ThemeTransitionOverlay />
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
