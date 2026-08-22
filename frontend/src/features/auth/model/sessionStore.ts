import { useSyncExternalStore } from 'react';
import { sessionEvents } from '@shared/api';

export type DemoSessionStatus = 'unauthenticated' | 'guest' | 'onboarding' | 'authenticated';
export type AuthChannel = 'phone' | 'email';

export interface DemoSession {
  status: DemoSessionStatus;
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

const STORAGE_KEY = 'vigazh-demo-session-v1';
const listeners = new Set<() => void>();
const serverSnapshot: DemoSession = { status: 'unauthenticated' };

function readStoredSession(): DemoSession {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: 'unauthenticated' };
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') return { status: 'unauthenticated' };
    const record = value as Record<string, unknown>;
    if (!['unauthenticated', 'guest', 'onboarding', 'authenticated'].includes(String(record.status))) {
      return { status: 'unauthenticated' };
    }
    const channel = record.channel === 'phone' || record.channel === 'email' ? record.channel : undefined;
    return {
      status: record.status as DemoSessionStatus,
      ...(channel ? { channel } : {}),
      ...(typeof record.identifier === 'string' ? { identifier: record.identifier } : {}),
    };
  } catch {
    return { status: 'unauthenticated' };
  }
}

let snapshot: DemoSession = typeof window === 'undefined' ? { status: 'unauthenticated' } : readStoredSession();

function commit(next: DemoSession) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The in-memory demo session remains usable when storage is restricted.
  }
  listeners.forEach((listener) => listener());
}

export const demoSession = {
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  continueAsGuest() {
    commit({ status: 'guest' });
  },
  beginOnboarding(channel: AuthChannel, identifier: string) {
    commit({ status: 'onboarding', channel, identifier });
  },
  completeOnboarding() {
    commit({ ...snapshot, status: 'authenticated' });
  },
  signOut() {
    commit({ status: 'unauthenticated' });
    sessionEvents.emit('session:reset', { source: 'auth' });
  },
};

export function useDemoSession(): DemoSession {
  return useSyncExternalStore(demoSession.subscribe, demoSession.getSnapshot, () => serverSnapshot);
}

export function maskAuthIdentifier(channel: AuthChannel, value: string): string {
  if (channel === 'email') {
    const [name, domain = ''] = value.split('@');
    return `${name.slice(0, 2)}${name.length > 2 ? '***' : ''}@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? `+7 ••• •••-${digits.slice(-4, -2)}-${digits.slice(-2)}` : value;
}

export function saveDemoProfileSetup(profile: DemoProfileSetup): void {
  try {
    window.localStorage.setItem('sutki-profile-demo-v2', JSON.stringify({ ...profile, patronymic: '', theme: 'system' }));
  } catch {
    // Session completion remains available in restricted browser modes.
  }
}
