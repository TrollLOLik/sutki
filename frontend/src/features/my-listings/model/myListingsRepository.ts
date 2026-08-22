import { useSyncExternalStore } from 'react';
import { sessionEvents } from '@shared/api';
import { listings, type Listing } from '@shared/data/listings';

export type OwnerListingStatus = 'active' | 'pending_moderation' | 'unpublished' | 'rejected';

export interface OwnerListing {
  listing: Listing;
  status: OwnerListingStatus;
  updatedAt: string;
  rejectionReason?: string;
  mapPoint?: { x: number; y: number };
  photos?: Array<{ id: string; url: string; name: string }>;
  promotionKinds?: Array<'top' | 'highlight'>;
}

const STORAGE_KEY = 'vigazh-owner-listings-demo-v1';
const CREATED_LISTINGS_KEY = 'sutki-created-listings';
const listeners = new Set<() => void>();

const seed: OwnerListing[] = [
  { listing: { ...listings[5], isOwn: true }, status: 'active', updatedAt: '2026-08-08T12:00:00.000Z', promotionKinds: listings[5].promoted ? [listings[5].promoted] : [] },
  { listing: { ...listings[3], id: 1001, isOwn: true, promoted: undefined }, status: 'pending_moderation', updatedAt: '2026-08-09T15:30:00.000Z' },
  { listing: { ...listings[1], id: 1002, isOwn: true, promoted: undefined }, status: 'unpublished', updatedAt: '2026-08-06T09:15:00.000Z' },
  { listing: { ...listings[4], id: 1003, isOwn: true, promoted: undefined }, status: 'rejected', rejectionReason: 'Добавьте фотографии кухни и уточните адрес.', updatedAt: '2026-08-04T18:20:00.000Z' },
  { listing: { ...listings[0], id: 1004, isOwn: true, promoted: undefined }, status: 'active', updatedAt: '2026-08-03T13:10:00.000Z' },
  { listing: { ...listings[2], id: 1005, isOwn: true, promoted: undefined }, status: 'pending_moderation', updatedAt: '2026-08-02T11:45:00.000Z' },
  { listing: { ...listings[4], id: 1006, isOwn: true, promoted: undefined }, status: 'unpublished', updatedAt: '2026-08-01T09:20:00.000Z' },
  { listing: { ...listings[1], id: 1007, isOwn: true, promoted: undefined }, status: 'active', updatedAt: '2026-07-31T18:05:00.000Z' },
  { listing: { ...listings[3], id: 1008, isOwn: true, promoted: undefined }, status: 'active', updatedAt: '2026-07-30T16:40:00.000Z' },
  { listing: { ...listings[5], id: 1009, isOwn: true, promoted: undefined }, status: 'pending_moderation', updatedAt: '2026-07-29T14:25:00.000Z' },
  { listing: { ...listings[0], id: 1010, isOwn: true, promoted: undefined }, status: 'unpublished', updatedAt: '2026-07-28T12:00:00.000Z' },
  { listing: { ...listings[2], id: 1011, isOwn: true, promoted: undefined }, status: 'active', updatedAt: '2026-07-27T10:15:00.000Z' },
];

function isStatus(value: unknown): value is OwnerListingStatus {
  return value === 'active' || value === 'pending_moderation' || value === 'unpublished' || value === 'rejected';
}

function readStored(): OwnerListing[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return seed;
    const valid = parsed.filter((item): item is OwnerListing => {
      if (!item || typeof item !== 'object') return false;
      const record = item as Record<string, unknown>;
      return isStatus(record.status) && typeof record.updatedAt === 'string' && Boolean(record.listing && typeof record.listing === 'object');
    });
    if (!valid.length) return seed;
    const storedIds = new Set(valid.map((item) => item.listing.id));
    return [...valid, ...seed.filter((item) => !storedIds.has(item.listing.id))];
  } catch {
    return seed;
  }
}

function readCreatedListings(rawValue?: string): OwnerListing[] {
  try {
    const parsed = JSON.parse(rawValue ?? window.localStorage.getItem(CREATED_LISTINGS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value, index) => {
      if (!value || typeof value !== 'object') return [];
      const record = value as Record<string, unknown>;
      const id = typeof record.id === 'number' ? record.id : Date.now() + index;
      const rooms = Number(record.rooms);
      const price = Number(record.price);
      const area = Number(record.area);
      const capacity = Number(record.maxGuests);
      const cityName = typeof record.city === 'string' && record.city ? record.city : 'Магнитогорск';
      const address = [record.street, record.houseNumber].filter((item): item is string => typeof item === 'string' && Boolean(item)).join(', ') || 'Адрес не указан';
      const rawMapPoint = record.mapPoint;
      const mapPoint = rawMapPoint && typeof rawMapPoint === 'object'
        && typeof (rawMapPoint as Record<string, unknown>).x === 'number'
        && typeof (rawMapPoint as Record<string, unknown>).y === 'number'
        ? { x: (rawMapPoint as Record<string, number>).x, y: (rawMapPoint as Record<string, number>).y }
        : undefined;
      const photos = Array.isArray(record.photos) ? record.photos.flatMap((photo, photoIndex) => {
        if (!photo || typeof photo !== 'object') return [];
        const candidate = photo as Record<string, unknown>;
        if (typeof candidate.url !== 'string' || !candidate.url) return [];
        return [{
          id: typeof candidate.id === 'string' ? candidate.id : `stored-${id}-${photoIndex}`,
          url: candidate.url,
          name: typeof candidate.name === 'string' ? candidate.name : `Фото ${photoIndex + 1}`,
        }];
      }) : undefined;
      return [{
        status: isStatus(record.status) ? record.status : 'pending_moderation' as const,
        updatedAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
        mapPoint,
        photos,
        promotionKinds: readPromotionKinds(record.promotionKinds, record.promoted),
        listing: {
          ...listings[5], id, isOwn: true, rooms: Number.isFinite(rooms) ? rooms : 1,
          price: Number.isFinite(price) ? price : 2500, area: Number.isFinite(area) ? area : 40,
          capacity: Number.isFinite(capacity) ? capacity : 2, cityName, city: cityName, address,
          title: typeof record.description === 'string' && record.description ? record.description : 'Новое объявление',
          coverUrl: typeof record.coverUrl === 'string' && record.coverUrl && !record.coverUrl.startsWith('blob:') ? record.coverUrl : listings[5].coverUrl,
          promoted: record.promoted === 'top' || record.promoted === 'highlight' ? record.promoted : undefined,
          createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
        },
      }];
    });
  } catch {
    return [];
  }
}

let snapshot = typeof window === 'undefined' ? seed : readStored();
let createdStorageValue = typeof window === 'undefined' ? '[]' : window.localStorage.getItem(CREATED_LISTINGS_KEY) ?? '[]';
function mergeListings(created: OwnerListing[], seeded: OwnerListing[]) {
  const createdIds = new Set(created.map((item) => item.listing.id));
  return [...created, ...seeded.filter((item) => !createdIds.has(item.listing.id))];
}

let combinedSnapshot = mergeListings(readCreatedListings(createdStorageValue), snapshot);

function getCombinedSnapshot() {
  const nextStorageValue = window.localStorage.getItem(CREATED_LISTINGS_KEY) ?? '[]';
  if (nextStorageValue !== createdStorageValue) {
    createdStorageValue = nextStorageValue;
    combinedSnapshot = mergeListings(readCreatedListings(createdStorageValue), snapshot);
  }
  return combinedSnapshot;
}

function persist(next: OwnerListing[]) {
  snapshot = next;
  combinedSnapshot = mergeListings(readCreatedListings(createdStorageValue), snapshot);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep the current tab usable. */ }
  listeners.forEach((listener) => listener());
}

export const myListingsRepository = {
  getSnapshot: getCombinedSnapshot,
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  setPublication(id: number, published: boolean) {
    if (!updateCreatedRecord(id, (record) => ({ ...record, status: published ? 'pending_moderation' : 'unpublished', updatedAt: new Date().toISOString() }))) {
      persist(snapshot.map((item) => item.listing.id === id ? { ...item, status: published ? 'pending_moderation' : 'unpublished', updatedAt: new Date().toISOString() } : item));
    }
    sessionEvents.emit('listing:changed', { source: 'my-listings', listingId: id, action: published ? 'published' : 'unpublished' });
  },
  promote(id: number, kind: 'top' | 'highlight' = 'top') {
    if (!updateCreatedRecord(id, (record) => ({ ...record, promoted: kind, promotionKinds: readPromotionKinds(record.promotionKinds, record.promoted, kind), updatedAt: new Date().toISOString() }))) {
      persist(snapshot.map((item) => item.listing.id === id ? {
        ...item,
        listing: { ...item.listing, promoted: kind },
        promotionKinds: readPromotionKinds(item.promotionKinds, item.listing.promoted, kind),
        updatedAt: new Date().toISOString(),
      } : item));
    }
    sessionEvents.emit('listing:changed', { source: 'my-listings', listingId: id, action: 'promoted' });
  },
  upsertPublished(payload: Record<string, unknown>) {
    const id = typeof payload.id === 'number' ? payload.id : Date.now();
    let records: Record<string, unknown>[] = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CREATED_LISTINGS_KEY) ?? '[]') as unknown;
      records = Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : [];
    } catch { records = []; }
    const previous = records.find((item) => item.id === id);
    const next = { ...previous, ...payload, id, status: previous?.status ?? payload.status ?? 'pending_moderation', updatedAt: new Date().toISOString() };
    const updated = [next, ...records.filter((item) => item.id !== id)].slice(0, 20);
    writeCreatedRecords(updated);
    sessionEvents.emit('listing:changed', { source: 'my-listings', listingId: id, action: previous ? 'updated' : 'created' });
  },
  reset() {
    snapshot = seed;
    createdStorageValue = '[]';
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(CREATED_LISTINGS_KEY);
    } catch { /* Keep the reset in memory. */ }
    combinedSnapshot = mergeListings([], snapshot);
    listeners.forEach((listener) => listener());
  },
};

function writeCreatedRecords(records: readonly Record<string, unknown>[]) {
  createdStorageValue = JSON.stringify(records);
  try { window.localStorage.setItem(CREATED_LISTINGS_KEY, createdStorageValue); } catch { /* Keep in-memory state. */ }
  combinedSnapshot = mergeListings(readCreatedListings(createdStorageValue), snapshot);
  listeners.forEach((listener) => listener());
}

function updateCreatedRecord(id: number, update: (record: Record<string, unknown>) => Record<string, unknown>): boolean {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CREATED_LISTINGS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return false;
    let found = false;
    const records = parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')).map((record) => {
      if (record.id !== id) return record;
      found = true;
      return update(record);
    });
    if (found) writeCreatedRecords(records);
    return found;
  } catch { return false; }
}

function readPromotionKinds(...values: unknown[]): Array<'top' | 'highlight'> {
  const result = new Set<'top' | 'highlight'>();
  values.forEach((value) => {
    const candidates = Array.isArray(value) ? value : [value];
    candidates.forEach((candidate) => {
      if (candidate === 'top' || candidate === 'highlight') result.add(candidate);
    });
  });
  return [...result];
}

export function useMyListingsSnapshot(): OwnerListing[] {
  return useSyncExternalStore(myListingsRepository.subscribe, myListingsRepository.getSnapshot, () => seed);
}

export function getOwnerListingCapabilities(status: OwnerListingStatus) {
  return {
    canEdit: true,
    canPromote: status === 'active',
    canPublish: status === 'unpublished' || status === 'rejected',
    canUnpublish: status === 'active',
  };
}

sessionEvents.subscribe('session:reset', ({ source }) => {
  if (source !== 'my-listings') myListingsRepository.reset();
});
