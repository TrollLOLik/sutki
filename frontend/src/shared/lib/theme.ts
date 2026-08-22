export type ThemePreference = 'light' | 'dark' | 'system';
export type MotionPreference = 'full' | 'reduced';
export type ThemeTransitionOrigin = { x: number; y: number };

const PROFILE_STORAGE_KEY = 'sutki-profile-demo-v2';
const THEME_STORAGE_KEY = 'sutki.themePreference';
const MOTION_STORAGE_KEY = 'sutki.motionPreference';
const COMPONENT_MARKERS_STORAGE_KEY = 'sutki.componentMarkers';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
let currentPreference: ThemePreference = 'system';
let initialized = false;
let activeReveal: HTMLElement | null = null;
const motionListeners = new Set<() => void>();
const componentMarkerListeners = new Set<() => void>();

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemePreference(): ThemePreference {
  try {
    const savedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(savedPreference)) return savedPreference;

    // Backward compatibility with builds that stored the preference inside the
    // demo profile object.
    const rawProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!rawProfile) return 'system';
    const parsed = JSON.parse(rawProfile) as { theme?: unknown };
    return isThemePreference(parsed.theme) ? parsed.theme : 'system';
  } catch {
    return 'system';
  }
}

function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function storedMotionPreference(): MotionPreference | null {
  try {
    const saved = window.localStorage.getItem(MOTION_STORAGE_KEY);
    return saved === 'full' || saved === 'reduced' ? saved : null;
  } catch {
    return null;
  }
}

export function readMotionPreference(): MotionPreference {
  return storedMotionPreference()
    ?? (window.matchMedia(REDUCED_MOTION_QUERY).matches ? 'reduced' : 'full');
}

export function applyMotionPreference(preference: MotionPreference) {
  const root = document.documentElement;
  if (root.dataset.motion === preference) return;
  root.dataset.motion = preference;
  motionListeners.forEach((listener) => listener());
}

export function setMotionPreference(preference: MotionPreference) {
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, preference);
  } catch {
    // Restricted storage should not prevent changing the current session.
  }
  applyMotionPreference(preference);
}

export function subscribeMotionPreference(listener: () => void) {
  motionListeners.add(listener);
  return () => motionListeners.delete(listener);
}

export function readComponentMarkers(): boolean {
  try {
    return window.localStorage.getItem(COMPONENT_MARKERS_STORAGE_KEY) === 'shown';
  } catch {
    return false;
  }
}

export function applyComponentMarkers(visible: boolean) {
  const value = visible ? 'shown' : 'hidden';
  if (document.documentElement.dataset.componentMarkers === value) return;
  document.documentElement.dataset.componentMarkers = value;
  componentMarkerListeners.forEach((listener) => listener());
}

export function setComponentMarkers(visible: boolean) {
  try {
    window.localStorage.setItem(COMPONENT_MARKERS_STORAGE_KEY, visible ? 'shown' : 'hidden');
  } catch {
    // Restricted storage should not prevent changing the current session.
  }
  applyComponentMarkers(visible);
}

export function subscribeComponentMarkers(listener: () => void) {
  componentMarkerListeners.add(listener);
  return () => componentMarkerListeners.delete(listener);
}

function updateThemeColor(theme: 'light' | 'dark') {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === 'dark' ? '#17181c' : '#ffffff');
}

export function applyThemePreference(preference: ThemePreference) {
  currentPreference = preference;
  const theme = resolvedTheme(preference);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  updateThemeColor(theme);
}

function revealColor(preference: ThemePreference) {
  if (preference === 'dark') return '#17181c';
  if (preference === 'light') return '#ffffff';
  return '#ff5a1f';
}

function applyThemeWithReveal(preference: ThemePreference, origin: ThemeTransitionOrigin) {
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  if (reducedMotion || !document.body) {
    applyThemePreference(preference);
    return;
  }

  activeReveal?.remove();

  const farthestX = Math.max(origin.x, window.innerWidth - origin.x);
  const farthestY = Math.max(origin.y, window.innerHeight - origin.y);
  const radius = Math.ceil(Math.hypot(farthestX, farthestY));
  const reveal = document.createElement('span');
  reveal.className = 'theme-transition-reveal';
  reveal.setAttribute('aria-hidden', 'true');
  reveal.style.setProperty('--theme-reveal-size', `${radius * 2}px`);
  reveal.style.setProperty('--theme-reveal-left', `${origin.x - radius}px`);
  reveal.style.setProperty('--theme-reveal-top', `${origin.y - radius}px`);
  reveal.style.setProperty('--theme-reveal-color', revealColor(preference));
  document.body.append(reveal);
  activeReveal = reveal;

  const grow = reveal.animate(
    [
      { transform: 'scale(0)', opacity: 1 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    { duration: 480, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' },
  );

  applyThemePreference(preference);

  void grow.finished
    .then(() => reveal.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 220, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' },
    ).finished)
    .catch(() => undefined)
    .finally(() => {
      reveal.remove();
      if (activeReveal === reveal) activeReveal = null;
    });
}

export function setThemePreference(
  preference: ThemePreference,
  origin?: ThemeTransitionOrigin,
) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable in private/restricted contexts. The current
    // session still gets the selected theme.
  }
  if (preference === currentPreference) return;
  if (origin) {
    applyThemeWithReveal(preference, origin);
    return;
  }
  applyThemePreference(preference);
}

export function clearThemePreference() {
  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Ignore storage failures and still restore the system preference.
  }
  applyThemePreference('system');
}

export function initializeTheme() {
  currentPreference = readThemePreference();
  applyMotionPreference(readMotionPreference());
  applyComponentMarkers(readComponentMarkers());
  applyThemePreference(currentPreference);
  if (initialized) return;
  initialized = true;

  const themeMedia = window.matchMedia(DARK_QUERY);
  const onSystemThemeChange = () => {
    if (currentPreference === 'system') applyThemePreference('system');
  };
  themeMedia.addEventListener('change', onSystemThemeChange);

  const motionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
  motionMedia.addEventListener('change', () => {
    if (!storedMotionPreference()) applyMotionPreference(motionMedia.matches ? 'reduced' : 'full');
  });
}
