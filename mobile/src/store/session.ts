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
import { useNetworkStatusStore } from '@/store/networkStatus';

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

async function persistUser(user: User) {
  await secureStorage.set(SECURE_KEYS.sessionUser, JSON.stringify(user));
}

function parsePersistedUser(value: string | null): User | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<User>;
    if (typeof parsed.id !== 'number' || typeof parsed.name !== 'string') return null;
    return parsed as User;
  } catch {
    return null;
  }
}

async function clearSessionStorage() {
  await Promise.all([
    secureStorage.remove(SECURE_KEYS.accessToken),
    secureStorage.remove(SECURE_KEYS.refreshToken),
    secureStorage.remove(SECURE_KEYS.sessionUser),
  ]);
}

export const useSessionStore = create<SessionState>((set, get) => {
  let hydrationRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let hydrationOnlineUnsubscribe: (() => void) | null = null;

  const cancelHydrationRetry = () => {
    if (hydrationRetryTimer) {
      clearTimeout(hydrationRetryTimer);
      hydrationRetryTimer = null;
    }
    hydrationOnlineUnsubscribe?.();
    hydrationOnlineUnsubscribe = null;
  };

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
    cancelHydrationRetry();

    const guestId = await initGuestId();
    set({ guestId });

    const [accessToken, refreshToken, hasChosenGuest, persistedUserValue] = await Promise.all([
      secureStorage.get(SECURE_KEYS.accessToken),
      secureStorage.get(SECURE_KEYS.refreshToken),
      secureStorage.get('sutki.hasChosenGuest'),
      secureStorage.get(SECURE_KEYS.sessionUser),
    ]);
    const persistedUser = parsePersistedUser(persistedUserValue);

    if (!accessToken && !refreshToken) {
      if (persistedUserValue) {
        await secureStorage.remove(SECURE_KEYS.sessionUser);
      }
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        status: hasChosenGuest === 'true' ? 'guest' : 'unauthenticated',
      });
      return;
    }

    const restoreLocalSession = () => {
      set({
        accessToken,
        refreshToken,
        user: persistedUser,
        status: persistedUser && needsOnboarding(persistedUser) ? 'onboarding' : 'authenticated',
      });
      if (accessToken && useNetworkStatusStore.getState().status !== 'offline') {
        useChatStore.getState().init(accessToken);
      }
    };

    const scheduleHydrationRetry = () => {
      cancelHydrationRetry();
      if (useNetworkStatusStore.getState().status === 'offline') {
        hydrationOnlineUnsubscribe = useNetworkStatusStore.subscribe((networkState) => {
          if (networkState.status !== 'online') return;
          cancelHydrationRetry();
          void hydrateFn();
        });
        return;
      }
      hydrationRetryTimer = setTimeout(() => {
        hydrationRetryTimer = null;
        void hydrateFn();
      }, 10_000);
    };

    set({ accessToken, refreshToken, user: persistedUser });
    try {
      const user = await fetchMe();
      await persistUser(user).catch((error) => {
        console.warn('Failed to cache user profile:', error);
      });
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
          await persistUser(res.user).catch((error) => {
            console.warn('Failed to cache refreshed user profile:', error);
          });
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
        } catch (refreshError) {
          if (!(refreshError instanceof ApiError) || refreshError.status !== 401) {
            restoreLocalSession();
            scheduleHydrationRetry();
            return;
          }
        }
      }

      const sessionIsDefinitelyInvalid =
        err instanceof ApiError && (err.status === 401 || err.status === 404);
      if (!sessionIsDefinitelyInvalid) {
        restoreLocalSession();
        scheduleHydrationRetry();
        return;
      }

      await clearSessionStorage();
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
    await persistUser(user).catch((error) => {
      console.warn('Failed to cache user profile:', error);
    });
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
    cancelHydrationRetry();
    const { refreshToken } = get();
    if (refreshToken) {
      await apiLogout(refreshToken).catch(() => undefined);
    }
    await clearSessionStorage();
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

    completeOnboarding: (user) => {
      set({ user, status: 'authenticated' });
      void persistUser(user).catch((error) => {
        console.warn('Failed to cache completed profile:', error);
      });
    },

    setUser: (user) => {
      set({ user });
      void persistUser(user).catch((error) => {
        console.warn('Failed to cache updated user profile:', error);
      });
    },

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

