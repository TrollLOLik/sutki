import { create } from 'zustand';

import { fetchMe, logout as apiLogout, refreshTokens } from '@/lib/api/auth';
import { ApiError, api } from '@/lib/api/client';
import { storeRef } from '@/lib/api/store-ref';
import { SECURE_KEYS, secureStorage } from '@/lib/secure-storage';
import { initGuestId, getGuestId } from '@/lib/guestId';
import { readLocalFavorites, writeLocalFavorites } from '@/lib/localFavorites';
import { addFavorite, fetchFavoriteIds } from '@/lib/api/favorites';
import { clearLocalViewedListings, readLocalViewedListings } from '@/lib/localViewedListings';
import { queryClient } from '@/lib/query';
import type { User } from '@/types/user';
import { useChatStore } from '@/store/chatStore';

export type AuthStatus = 'loading' | 'authenticated' | 'onboarding' | 'guest' | 'unauthenticated';

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
  guestId: string | null;
  /** Restore the session on app start: read tokens, then fetch /me. */
  hydrate: () => Promise<void>;
  bootstrap: () => Promise<void>;
  /**
   * Persist tokens after a successful code verification. Returns true when the
   * user still needs to complete onboarding (no name yet). The status is set to
   * `onboarding` or `authenticated` accordingly; the root layout guard then
   * mounts profile-setup or the tabs — no manual navigation needed.
   */
  beginSession: (tokens: Tokens, user: User) => Promise<boolean>;
  loginSuccess: (tokens: Tokens, user: User) => Promise<boolean>;
  /** Finish onboarding (profile created) → authenticated. */
  completeOnboarding: (user: User) => void;
  /** Replace the cached user after a profile update (PATCH /me). */
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
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

export const useSessionStore = create<SessionState>((set, get) => {
  const mergeLocalFavorites = async () => {
    try {
      const localIds = await readLocalFavorites();
      if (localIds.length === 0) return;
      const serverIds = await fetchFavoriteIds().catch(() => [] as number[]);
      const serverIdSet = new Set(serverIds);
      const toAdd = localIds.filter((id) => !serverIdSet.has(id));
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map((id) => addFavorite(id).catch(() => undefined)));
      }
      await writeLocalFavorites([]);
    } catch (e) {
      console.error('Failed to merge local favorites', e);
    }
  };

  const mergeLocalViewedListings = async () => {
    try {
      const localItems = await readLocalViewedListings();
      if (localItems.length === 0) return;
      await api.post<void>('/api/v1/me/viewed-listings/import', {
        ids: localItems.map((item) => item.id),
      });
      clearLocalViewedListings();
      await queryClient.invalidateQueries({ queryKey: ['viewed-listings'] });
    } catch (error) {
      // Keep local history for the next login/restore attempt.
      console.error('Failed to merge local viewed listings', error);
    }
  };

  const hydrateFn = async () => {
    const guestId = await initGuestId();
    set({ guestId });

    const [accessToken, refreshToken, hasChosenGuest] = await Promise.all([
      secureStorage.get(SECURE_KEYS.accessToken),
      secureStorage.get(SECURE_KEYS.refreshToken),
      secureStorage.get('sutki.hasChosenGuest'),
    ]);

    if (!accessToken && !refreshToken) {
      set({ status: hasChosenGuest === 'true' ? 'guest' : 'unauthenticated' });
      return;
    }

    set({ accessToken, refreshToken });
    try {
      const user = await fetchMe();
      set({ user, status: needsOnboarding(user) ? 'onboarding' : 'authenticated' });
      if (accessToken) {
        useChatStore.getState().init(accessToken);
      }
      await mergeLocalFavorites();
      await mergeLocalViewedListings();
      return;
    } catch (err) {
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
          useChatStore.getState().init(res.access_token);
          await mergeLocalFavorites();
          await mergeLocalViewedListings();
          return;
        } catch {
          // refresh failed
        }
      }
      await clearTokens();
      useChatStore.getState().disconnect();
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        status: hasChosenGuest === 'true' ? 'guest' : 'unauthenticated',
      });
    }
  };

  const beginSessionFn = async ({ accessToken, refreshToken }: Tokens, user: User) => {
    await persistTokens(accessToken, refreshToken);
    const needsProfile = needsOnboarding(user);
    set({
      accessToken,
      refreshToken,
      user,
      status: needsProfile ? 'onboarding' : 'authenticated',
    });
    useChatStore.getState().init(accessToken);
    await mergeLocalFavorites();
    await mergeLocalViewedListings();
    return needsProfile;
  };

  const signOutFn = async () => {
    const { refreshToken } = get();
    if (refreshToken) {
      await apiLogout(refreshToken).catch(() => undefined);
    }
    await clearTokens();
    useChatStore.getState().disconnect();
    const hasChosenGuest = await secureStorage.get('sutki.hasChosenGuest');
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      status: hasChosenGuest === 'true' ? 'guest' : 'unauthenticated',
    });
  };

  return {
    status: 'loading',
    accessToken: null,
    refreshToken: null,
    user: null,
    guestId: null,

    hydrate: hydrateFn,
    bootstrap: hydrateFn,

    beginSession: beginSessionFn,
    loginSuccess: beginSessionFn,

    completeOnboarding: (user) => set({ user, status: 'authenticated' }),

    setUser: (user) => set({ user }),

    signOut: signOutFn,
    logout: signOutFn,

    continueAsGuest: async () => {
      const guestId = await initGuestId();
      await secureStorage.set('sutki.hasChosenGuest', 'true');
      set({ status: 'guest', guestId });
    },
  };
});

storeRef.getState = useSessionStore.getState;

export function useIsGuest(): boolean {
  return useSessionStore((state) => state.status === 'guest');
}

