import { useEffect, useSyncExternalStore } from 'react';
import { sessionEvents } from '@shared/api';
import { loadWebSession, logoutWebSession } from '../api/webAuth';
import type { AuthChannel, WebAuthUser } from './webAuthTypes';

export type DemoSessionStatus = 'loading' | 'unauthenticated' | 'guest' | 'onboarding' | 'authenticated';
export type { AuthChannel } from './webAuthTypes';

export interface DemoSession {
  status: DemoSessionStatus;
  user: WebAuthUser | null;
  channel?: AuthChannel;
  identifier?: string;
}

export interface DemoProfileSetup {
  name: string;
  surname: string;
  city: string;
  birthday: string;
  avatar: string;
  phone: string;
  email: string;
}

const GUEST_KEY = 'vigazh-web-guest-mode-v1';
const listeners = new Set<() => void>();
const serverSnapshot: DemoSession = { status: 'loading', user: null };
let snapshot: DemoSession = serverSnapshot;
let hydrationPromise: Promise<void> | null = null;

function commit(next: DemoSession) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function guestWasChosen(): boolean {
  try {
    return window.localStorage.getItem(GUEST_KEY) === 'true';
  } catch {
    return false;
  }
}

async function hydrate(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const session = await loadWebSession();
      if (session.status === 'authenticated' || session.status === 'onboarding') {
        commit({ status: session.status, user: session.user });
        return;
      }
      commit({ status: guestWasChosen() ? 'guest' : 'unauthenticated', user: null });
    } catch {
      // Keep the public catalog usable when the API is temporarily unavailable.
      commit({ status: guestWasChosen() ? 'guest' : 'unauthenticated', user: null });
    }
  })().finally(() => {
    hydrationPromise = null;
  });
  return hydrationPromise;
}

export const demoSession = {
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  hydrate,
  continueAsGuest() {
    try {
      window.localStorage.setItem(GUEST_KEY, 'true');
    } catch {
      // In-memory guest mode still works when storage is restricted.
    }
    commit({ status: 'guest', user: null });
  },
  beginSession(user: WebAuthUser) {
    try {
      window.localStorage.removeItem(GUEST_KEY);
    } catch {
      // The server session remains authoritative.
    }
    commit({ status: user.name.trim() ? 'authenticated' : 'onboarding', user });
  },
  beginOnboarding(channel: AuthChannel, identifier: string) {
    commit({ ...snapshot, status: 'onboarding', channel, identifier });
  },
  completeOnboarding(user?: WebAuthUser) {
    commit({ ...snapshot, status: 'authenticated', user: user ?? snapshot.user });
  },
  setUser(user: WebAuthUser) {
    commit({ ...snapshot, user, status: user.name.trim() ? 'authenticated' : 'onboarding' });
  },
  signOut() {
    void logoutWebSession().catch(() => undefined);
    commit({ status: 'unauthenticated', user: null });
    sessionEvents.emit('session:reset', { source: 'auth' });
  },
};

export function useDemoSession(): DemoSession {
  const session = useSyncExternalStore(demoSession.subscribe, demoSession.getSnapshot, () => serverSnapshot);
  useEffect(() => {
    if (session.status === 'loading') void demoSession.hydrate();
  }, [session.status]);
  return session;
}

export function maskAuthIdentifier(channel: AuthChannel, value: string): string {
  if (channel === 'email') {
    const [name, domain = ''] = value.split('@');
    return `${name.slice(0, 2)}${name.length > 2 ? '***' : ''}@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? `+7 ••• •••-${digits.slice(-4, -2)}-${digits.slice(-2)}` : value;
}
