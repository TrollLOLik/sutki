import { colorScheme } from 'nativewind';
import { create } from 'zustand';

import { secureStorage } from '@/lib/secure-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_KEY = 'sutki.themePreference';

function isThemePreference(v: string | null): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

interface ThemeState {
  /** User preference; 'system' follows the OS appearance. */
  preference: ThemePreference;
  /** True once the persisted preference has been read (splash waits on it). */
  hasHydrated: boolean;
  /** Read the persisted preference and apply it. Called once on app start. */
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => void;
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
}));
