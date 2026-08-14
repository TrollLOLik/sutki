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
  /** Semi-transparent surface for floating controls layered over maps/photos. */
  overlaySurface: string;

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
  overlaySurface: 'rgba(255, 255, 255, 0.9)',

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
  overlaySurface: 'rgba(23, 24, 28, 0.9)',

  line: '#2C2F35',
};

export const radii = {
  field: 12,
  card: 16,
  pill: 999,
} as const;

/**
 * Shared mobile typography scale. Components may add layout styles, but font
 * size, line height and weight should come from one of these variants.
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '900' },
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '800' },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  captionStrong: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  price: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const iconSizes = {
  xs: 14,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export type IconSizeToken = keyof typeof iconSizes;

export const pressMotion = {
  scale: 0.97,
  inDuration: 70,
  variants: {
    compact: {
      scale: 0.94,
      opacity: 0.88,
      inDuration: 65,
    },
    control: {
      scale: 0.97,
      opacity: 0.93,
      inDuration: 75,
    },
    surface: {
      scale: 0.988,
      opacity: 0.96,
      inDuration: 90,
    },
  },
  spring: {
    damping: 17,
    stiffness: 280,
    mass: 0.55,
  },
} as const;

export type PressMotionVariant = keyof typeof pressMotion.variants;

export const selectionMotion = {
  duration: 190,
  spring: {
    damping: 18,
    stiffness: 280,
    mass: 0.65,
    overshootClamping: true,
  },
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
