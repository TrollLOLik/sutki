import { create } from 'zustand';

import { fetchMe, logout, refreshTokens } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { SECURE_KEYS, secureStorage } from '@/lib/secure-storage';
import type { User } from '@/types/user';

export type AuthStatus = 'loading' | 'authenticated' | 'onboarding' | 'unauthenticated';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** A profile is incomplete until the user has set a name. */
function needsOnboarding(user: User): boolean {
  return user.name.trim() === '';
}

interface SessionState {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  /** Restore the session on app start: read tokens, then fetch /me. */
  hydrate: () => Promise<void>;
  /**
   * Persist tokens after a successful code verification. Returns true when the
   * user still needs to complete onboarding (no name yet). The status is set to
   * `onboarding` or `authenticated` accordingly; the root layout guard then
   * mounts profile-setup or the tabs — no manual navigation needed.
   */
  beginSession: (tokens: Tokens, user: User) => Promise<boolean>;
  /** Finish onboarding (profile created) → authenticated. */
  completeOnboarding: (user: User) => void;
  /** Replace the cached user after a profile update (PATCH /me). */
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
}

async function persistTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    secureStorage.set(SECURE_KEYS.accessToken, accessToken),
    secureStorage.set(SECURE_KEYS.refreshToken, refreshToken),
  ]);
}

async function clearTokens() {
  await Promise.all([
    secureStorage.remove(SECURE_KEYS.accessToken),
    secureStorage.remove(SECURE_KEYS.refreshToken),
  ]);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  accessToken: null,
  refreshToken: null,
  user: null,

  hydrate: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      secureStorage.get(SECURE_KEYS.accessToken),
      secureStorage.get(SECURE_KEYS.refreshToken),
    ]);
    if (!accessToken && !refreshToken) {
      set({ status: 'unauthenticated' });
      return;
    }
    // Expose the token to the API client before calling /me.
    set({ accessToken, refreshToken });
    try {
      const user = await fetchMe();
      set({ user, status: needsOnboarding(user) ? 'onboarding' : 'authenticated' });
      return;
    } catch (err) {
      // Access token expired/invalid: attempt a one-shot refresh.
      if (err instanceof ApiError && err.status === 401 && refreshToken) {
        try {
          const res = await refreshTokens(refreshToken);
          await persistTokens(res.access_token, res.refresh_token);
          set({
            accessToken: res.access_token,
            refreshToken: res.refresh_token,
            user: res.user,
            status: needsOnboarding(res.user) ? 'onboarding' : 'authenticated',
          });
          return;
        } catch {
          // refresh failed → fall through to sign-out
        }
      }
      await clearTokens();
      set({ accessToken: null, refreshToken: null, user: null, status: 'unauthenticated' });
    }
  },

  beginSession: async ({ accessToken, refreshToken }, user) => {
    await persistTokens(accessToken, refreshToken);
    const needsProfile = needsOnboarding(user);
    set({
      accessToken,
      refreshToken,
      user,
      status: needsProfile ? 'onboarding' : 'authenticated',
    });
    return needsProfile;
  },

  completeOnboarding: (user) => set({ user, status: 'authenticated' }),

  setUser: (user) => set({ user }),

  signOut: async () => {
    const { refreshToken } = get();
    if (refreshToken) {
      // Best-effort revoke; ignore network/server errors on the way out.
      await logout(refreshToken).catch(() => undefined);
    }
    await clearTokens();
    set({ accessToken: null, refreshToken: null, user: null, status: 'unauthenticated' });
  },
}));
