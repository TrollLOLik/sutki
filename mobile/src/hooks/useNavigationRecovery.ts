import { router, type Href, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

const stableRootPaths = new Set([
  '/',
  '/map',
  '/messages',
  '/profile',
  '/welcome',
  '/email',
  '/phone',
  '/code',
  '/profile-setup',
]);

function fallbackFor(pathname: string): Href {
  if (pathname.startsWith('/chat/')) return '/(tabs)/messages';
  if (
    pathname.startsWith('/bookings') ||
    pathname.startsWith('/incoming') ||
    pathname.startsWith('/my-listings') ||
    pathname.startsWith('/my-reviews') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/payments')
  ) {
    return '/(tabs)/profile';
  }
  return '/(tabs)';
}

export function useNavigationRecovery() {
  const pathname = usePathname();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack() || stableRootPaths.has(pathname)) return false;
      router.replace(fallbackFor(pathname));
      return true;
    });
    return () => subscription.remove();
  }, [pathname]);
}
