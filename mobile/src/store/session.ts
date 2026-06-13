import { create } from 'zustand';

import { SECURE_KEYS, secureStorage } from '@/lib/secure-storage';
import type { User } from '@/types/user';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface SessionState {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  /** Read persisted tokens from secure storage on app start. */
  hydrate: () => Promise<void>;
  /** Persist tokens + set the session as authenticated. */
  signIn: (tokens: Tokens, user: User | null) => Promise<void>;
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  accessToken: null,
  refreshToken: null,
  user: null,

  hydrate: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      secureStorage.get(SECURE_KEYS.accessToken),
      secureStorage.get(SECURE_KEYS.refreshToken),
    ]);
    set({
      accessToken,
      refreshToken,
      status: accessToken ? 'authenticated' : 'unauthenticated',
    });
  },

  signIn: async ({ accessToken, refreshToken }, user) => {
    await Promise.all([
      secureStorage.set(SECURE_KEYS.accessToken, accessToken),
      secureStorage.set(SECURE_KEYS.refreshToken, refreshToken),
    ]);
    set({ accessToken, refreshToken, user, status: 'authenticated' });
  },

  setUser: (user) => set({ user }),

  signOut: async () => {
    await Promise.all([
      secureStorage.remove(SECURE_KEYS.accessToken),
      secureStorage.remove(SECURE_KEYS.refreshToken),
    ]);
    set({ accessToken: null, refreshToken: null, user: null, status: 'unauthenticated' });
  },
}));
