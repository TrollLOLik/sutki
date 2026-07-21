import { File, Paths } from 'expo-file-system';

const MAX_VIEWED_LISTINGS = 500;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export interface LocalViewedListing {
  id: number;
  viewed_at: string;
}

function getViewedListingsFile(): File {
  return new File(Paths.document, 'viewed-listings.json');
}

export async function readLocalViewedListings(): Promise<LocalViewedListing[]> {
  try {
    const file = getViewedListingsFile();
    if (!file.exists) return [];

    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) return [];

    const cutoff = Date.now() - RETENTION_MS;
    const seen = new Set<number>();
    const items: LocalViewedListing[] = [];
    for (const value of parsed) {
      const id = Number(value?.id);
      const viewedAt = typeof value?.viewed_at === 'string' ? value.viewed_at : '';
      const timestamp = Date.parse(viewedAt);
      if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(timestamp) || timestamp < cutoff || seen.has(id)) {
        continue;
      }
      seen.add(id);
      items.push({ id, viewed_at: viewedAt });
      if (items.length >= MAX_VIEWED_LISTINGS) break;
    }
    return items;
  } catch (error) {
    console.error('Failed to read local viewed listings', error);
    return [];
  }
}

export async function rememberLocalViewedListing(id: number): Promise<LocalViewedListing[]> {
  const current = await readLocalViewedListings();
  const next = [
    { id, viewed_at: new Date().toISOString() },
    ...current.filter((item) => item.id !== id),
  ].slice(0, MAX_VIEWED_LISTINGS);
  try {
    getViewedListingsFile().write(JSON.stringify(next));
  } catch (error) {
    console.error('Failed to persist local viewed listings', error);
  }
  return next;
}

export function clearLocalViewedListings(): void {
  try {
    const file = getViewedListingsFile();
    if (file.exists) file.delete();
  } catch (error) {
    console.error('Failed to clear local viewed listings', error);
  }
}
