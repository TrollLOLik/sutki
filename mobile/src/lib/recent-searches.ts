import { SECURE_KEYS, secureStorage } from '@/lib/secure-storage';

/**
 * Recent city searches, persisted as a small JSON list. Most-recent first,
 * de-duplicated (case-insensitive), capped at MAX_RECENT entries.
 *
 * Backed by secureStorage (expo-secure-store) so no new native dependency is
 * needed — the payload is a handful of city names, well under the size limit.
 */
const MAX_RECENT = 6;

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  } catch {
    return [];
  }
}

export async function getRecentSearches(): Promise<string[]> {
  const raw = await secureStorage.get(SECURE_KEYS.recentSearches);
  return parse(raw);
}

/** Prepend a search term, drop any case-insensitive duplicate, cap the list. */
export async function addRecentSearch(term: string): Promise<string[]> {
  const value = term.trim();
  if (value.length === 0) return getRecentSearches();
  const current = await getRecentSearches();
  const deduped = current.filter((c) => c.toLowerCase() !== value.toLowerCase());
  const next = [value, ...deduped].slice(0, MAX_RECENT);
  await secureStorage.set(SECURE_KEYS.recentSearches, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await secureStorage.remove(SECURE_KEYS.recentSearches);
}
