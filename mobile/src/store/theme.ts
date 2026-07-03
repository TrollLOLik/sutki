import { colorScheme } from 'nativewind';
import { create } from 'zustand';

import { secureStorage } from '@/lib/secure-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_KEY = 'sutki.themePreference';

function isThemePreference(v: string | null): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

export interface ThemeTransition {
  active: boolean;
  origin: { x: number; y: number } | null;
  /** The theme we are transitioning TO (used to pick overlay color). */
  targetPreference: ThemePreference | null;
}

interface ThemeState {
  /** User preference; 'system' follows the OS appearance. */
  preference: ThemePreference;
  /** True once the persisted preference has been read (splash waits on it). */
  hasHydrated: boolean;
  /** Circular-reveal animation state. */
  transition: ThemeTransition;
  /** Read the persisted preference and apply it. Called once on app start. */
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => void;
  /**
   * Begin the animated theme switch. Sets transition.active so the root
   * overlay mounts and starts its animation, swaps colorScheme immediately
   * (new theme renders under the overlay), and persists the choice.
   */
  startThemeTransition: (
    origin: { x: number; y: number },
    preference: ThemePreference,
  ) => void;
  /** Called by the overlay once its exit animation finishes. */
  endThemeTransition: () => void;
}

/**
 * Theme preference store. Persists via the existing SecureStore wrapper
 * (avoids adding AsyncStorage as a new native dependency) and drives
 * NativeWind's colorScheme, which in turn controls both the CSS variables on
 * the root View (app/_layout.tsx) and useAppTheme().
 */
export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  hasHydrated: false,
  transition: { active: false, origin: null, targetPreference: null },

  hydrate: async () => {
    let preference: ThemePreference = 'system';
    try {
      const stored = await secureStorage.get(THEME_KEY);
      if (isThemePreference(stored)) preference = stored;
    } catch {
      // Unreadable value — fall back to system.
    }
    colorScheme.set(preference);
    set({ preference, hasHydrated: true });
  },

  setPreference: (preference) => {
    colorScheme.set(preference);
    set({ preference });
    // Fire-and-forget: persistence failure must not break theme switching.
    secureStorage.set(THEME_KEY, preference).catch(() => undefined);
  },

  startThemeTransition: (origin, preference) => {
    // 1. Activate overlay FIRST so it covers the swap.
    set({ transition: { active: true, origin, targetPreference: preference } });
    // 2. Swap the theme — new theme renders under the expanding circle.
    colorScheme.set(preference);
    set({ preference });
    secureStorage.set(THEME_KEY, preference).catch(() => undefined);
  },

  endThemeTransition: () => {
    set({ transition: { active: false, origin: null, targetPreference: null } });
  },
}));
