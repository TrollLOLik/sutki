/**
 * Design tokens — single source of truth for raw color values used outside of
 * NativeWind className strings (navigation theme, status bar, vector icons,
 * gradients). Keep in sync with tailwind.config.js.
 */
export const palette = {
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
} as const;

export const radii = {
  field: 12,
  card: 16,
  pill: 999,
} as const;

/** Max content width used by SafeContainer to keep auth/profile screens
 * centered on tablets/iPad (per TZ §3). */
export const MAX_CONTENT_WIDTH = 600;
