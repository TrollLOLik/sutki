import { readThemePreference, type ThemePreference } from '@shared/lib/theme';

export type ProfileTheme = ThemePreference;

export type ProfileData = {
  name: string;
  surname: string;
  patronymic: string;
  phone: string;
  email: string;
  city: string;
  birthday: string;
  avatar: string;
  theme: ProfileTheme;
};

export type SessionItem = {
  id: string;
  device: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  current?: boolean;
};

const PROFILE_STORAGE_KEY = 'sutki-profile-demo-v2';
const SESSION_STORAGE_KEY = 'sutki-profile-sessions-v1';

const DEFAULT_PROFILE: Readonly<ProfileData> = {
  name: 'Артём',
  surname: 'Иванов',
  patronymic: '',
  phone: '+7 (999) 123-45-67',
  email: 'artem@example.ru',
  city: 'Москва',
  birthday: '1997-08-14',
  avatar: '',
  theme: 'system',
};

const DEFAULT_SESSIONS: ReadonlyArray<SessionItem> = [
  {
    id: 'current',
    device: 'Windows PC · Brave',
    os: 'Windows 11',
    location: 'Москва',
    ip: '127.0.0.1',
    lastActive: 'Сейчас',
    current: true,
  },
  {
    id: 'phone',
    device: 'iPhone 15',
    os: 'iOS 18',
    location: 'Москва',
    ip: '192.168.1.12',
    lastActive: '2 часа назад',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readProfileValue(value: unknown): ProfileData {
  const fallback = createDefaultProfile();
  if (!isRecord(value)) return fallback;

  return {
    name: readString(value.name, fallback.name),
    surname: readString(value.surname, fallback.surname),
    patronymic: readString(value.patronymic, fallback.patronymic),
    phone: readString(value.phone, fallback.phone),
    email: readString(value.email, fallback.email),
    city: readString(value.city, fallback.city),
    birthday: readString(value.birthday, fallback.birthday),
    avatar: readString(value.avatar, fallback.avatar),
    theme: readThemePreference(),
  };
}

function readSessionValue(value: unknown): SessionItem | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const device = typeof value.device === 'string' ? value.device : '';
  const os = typeof value.os === 'string' ? value.os : '';
  const location = typeof value.location === 'string' ? value.location : '';
  const ip = typeof value.ip === 'string' ? value.ip : '';
  const lastActive = typeof value.lastActive === 'string' ? value.lastActive : '';
  if (!id || !device || !os || !location || !ip || !lastActive) return null;

  return {
    id,
    device,
    os,
    location,
    ip,
    lastActive,
    current: value.current === true || undefined,
  };
}

export function createDefaultProfile(): ProfileData {
  return { ...DEFAULT_PROFILE, theme: readThemePreference() };
}

export function createDefaultSessions(): SessionItem[] {
  return DEFAULT_SESSIONS.map((session) => ({ ...session }));
}

export function loadProfile(): ProfileData {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? readProfileValue(JSON.parse(raw) as unknown) : createDefaultProfile();
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: ProfileData): void {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Restricted storage must not prevent editing the current in-memory profile.
  }
}

export function loadSessions(): SessionItem[] {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return createDefaultSessions();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return createDefaultSessions();
    const sessions = parsed.map(readSessionValue).filter((session): session is SessionItem => session !== null);
    return sessions.length ? sessions : createDefaultSessions();
  } catch {
    return createDefaultSessions();
  }
}

export function saveSessions(sessions: readonly SessionItem[]): void {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Restricted storage must not prevent session changes in the current tab.
  }
}

export function clearProfileStorage(): void {
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Reset the current in-memory state even if browser storage is unavailable.
  }
}

export function profileInitials(profile: ProfileData): string {
  const parts = [profile.name, profile.surname].filter(Boolean);
  return parts.length ? parts.map((part) => part.trim().slice(0, 1)).join('').toUpperCase() : 'ДР';
}

export function profileDisplayName(profile: ProfileData): string {
  return [profile.surname, profile.name, profile.patronymic].filter(Boolean).join(' ') || 'Гость';
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11);
  const local = digits.startsWith('7') ? digits.slice(1) : digits;
  let result = '+7';
  if (local.length) result += ` (${local.slice(0, 3)}`;
  if (local.length >= 3) result += ')';
  if (local.length > 3) result += ` ${local.slice(3, 6)}`;
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;
  return result;
}
