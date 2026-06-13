export type ClassValue = string | false | null | undefined;

/** Tiny classnames helper for NativeWind className strings. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
