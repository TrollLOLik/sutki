import { useColorScheme } from 'nativewind';

import { darkPalette, lightPalette, type Palette } from '@/theme/tokens';

export type AppScheme = 'light' | 'dark';

export interface AppTheme {
  /** Resolved scheme ('system' preference is already resolved by nativewind). */
  scheme: AppScheme;
  isDark: boolean;
  /** Palette for JS-side colors: icons, gradients, navigation, shadows. */
  palette: Palette;
}

/**
 * Theme hook for all JS-side color usage (vector icons, gradients, native
 * component props). Tailwind className colors flip automatically via CSS
 * variables — this hook is only needed where a raw color value is required.
 */
export function useAppTheme(): AppTheme {
  const { colorScheme } = useColorScheme();
  const scheme: AppScheme = colorScheme === 'dark' ? 'dark' : 'light';
  return {
    scheme,
    isDark: scheme === 'dark',
    palette: scheme === 'dark' ? darkPalette : lightPalette,
  };
}
