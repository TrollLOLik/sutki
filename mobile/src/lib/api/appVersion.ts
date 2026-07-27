import { getDeviceMetadata } from '@/lib/device';
import { env } from '@/lib/env';
import { useAppVersionStore } from '@/store/appVersion';

interface AppVersionResponse {
  minimum_supported_version?: string;
}

/**
 * Startup probe: ask the backend what it still supports and flip the upgrade
 * flag before the user reaches a screen that would fail.
 *
 * Deliberately not routed through `api`: /app-version sits outside /api/v1 and
 * outside the version gate — a build too old to talk to the API still has to be
 * able to ask what "new enough" means — and it must not trigger the client's
 * auth-refresh or error-translation machinery.
 *
 * Failure is silent. Offline or a backend hiccup at launch must not present
 * itself as "your app is out of date"; any real 426 from an ordinary request
 * sets the same flag anyway.
 */
export async function checkMinAppVersion(): Promise<void> {
  try {
    const res = await fetch(`${env.apiUrl}/app-version`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;
    const body = (await res.json()) as AppVersionResponse;
    const minimum = body.minimum_supported_version?.trim();
    if (!minimum) return;

    const { appVersion } = getDeviceMetadata();
    // Unknown version (web build, Expo Go): the server's gate fails open on a
    // missing header, so the client must not block itself either.
    if (!appVersion) return;
    if (isOlder(appVersion, minimum)) {
      useAppVersionStore.getState().requireUpgrade(minimum);
    }
  } catch {
    // Offline, DNS failure, backend down — none of these mean "out of date".
  }
}

/** Component-wise numeric compare, mirroring the backend's parser. */
function isOlder(current: string, minimum: string): boolean {
  const a = parse(current);
  const b = parse(minimum);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

function parse(raw: string): number[] | null {
  const cleaned = raw.trim().replace(/^v/, '').split(/[-+]/)[0];
  if (!cleaned) return null;
  const parts = cleaned.split('.');
  if (parts.length > 4) return null;
  const out: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    out.push(Number(part));
  }
  return out;
}
