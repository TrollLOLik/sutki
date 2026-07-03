/**
 * Design tokens — single source of truth for raw color values used outside of
 * NativeWind className strings (navigation theme, status bar, vector icons,
 * gradients). Keep in sync with tailwind.config.js and src/theme/vars.ts.
 *
 * Components must consume colors via useAppTheme() so they react to the
 * active color scheme:
 *   const { palette } = useAppTheme();
 */

export interface Palette {
  primary: string;
  primaryPressed: string;
  primaryLight: string;

  success: string;
  successLight: string;

  info: string;
  infoLight: string;

  danger: string;
  dangerLight: string;

  star: string;

  ink: string;
  inkSecondary: string;
  inkMuted: string;

  surface: string;
  surfaceMuted: string;
  surfaceSkeleton: string;

  line: string;
}

export const lightPalette: Palette = {
  primary: '#FF5A1F',
  primaryPressed: '#E64A14',
  primaryLight: '#FFF1EC',

  success: '#2EAD6B',
  successLight: '#E8F7EF',

  info: '#2F80ED',
  infoLight: '#EAF2FE',

  danger: '#E5484D',
  dangerLight: '#FDECEC',

  star: '#FFB400',

  ink: '#1A1A1A',
  inkSecondary: '#6B7280',
  inkMuted: '#9AA0A6',

  surface: '#FFFFFF',
  surfaceMuted: '#F5F6F8',
  surfaceSkeleton: '#E9EBEE',

  line: '#ECECEC',
};

export const darkPalette: Palette = {
  // Slightly brighter primary reads better on dark surfaces.
  primary: '#FF6B35',
  primaryPressed: '#E64A14',
  primaryLight: '#3A2318',

  success: '#3DBF7C',
  successLight: '#173226',

  info: '#4D94F2',
  infoLight: '#16283E',

  danger: '#F0565B',
  dangerLight: '#3B1D1F',

  star: '#FFB400',

  ink: '#F2F3F5',
  inkSecondary: '#9BA1AA',
  inkMuted: '#6E747D',

  surface: '#17181C',
  surfaceMuted: '#1F2126',
  surfaceSkeleton: '#2A2D33',

  line: '#2C2F35',
};

/**
 * @deprecated Static light palette kept only while screens are being migrated
 * to useAppTheme(). Will be removed at the end of the dark-theme migration —
 * do not add new usages.
 */
export const palette = lightPalette;

export const radii = {
  field: 12,
  card: 16,
  pill: 999,
} as const;

/**
 * Shadows intentionally use a fixed near-black color rather than `ink`:
 * in dark mode ink is near-white, and a light shadow color would render as a
 * glow. Dark-mode "elevation" is instead conveyed by surfaceMuted layering.
 */
export const shadows = {
  card: {
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  tile: {
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
} as const;

/** Max content width used by SafeContainer to keep auth/profile screens
 * centered on tablets/iPad (per TZ §3). */
export const MAX_CONTENT_WIDTH = 600;
