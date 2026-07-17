import { router, type Href } from 'expo-router';

/** Pops the current screen, or restores a stable app route for deep links/replaces. */
export function goBackOrReplace(fallback: Href = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
