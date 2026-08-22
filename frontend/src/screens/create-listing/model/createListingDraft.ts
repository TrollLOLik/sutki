export type RuleValue = '' | 'allowed' | 'forbidden' | 'on_request' | 'on_balcony';

export interface ListingPhoto {
  id: string;
  url: string;
  name: string;
  status?: 'checking' | 'ready' | 'error';
}

export interface ListingMapPoint {
  x: number;
  y: number;
}

interface CreateListingTransientDraft {
  photos: ListingPhoto[];
  mapPoint: ListingMapPoint;
}

let transientDraft: CreateListingTransientDraft = {
  photos: [],
  mapPoint: { x: 57, y: 47 },
};

export interface ValidationError {
  message: string;
  anchor: string;
}

export interface CreateListingDraft {
  category: string;
  categoryIds: string[];
  rooms: string;
  city: string;
  street: string;
  houseNumber: string;
  area: string;
  price: string;
  maxGuests: string;
  amenities: string[];
  description: string;
  checkInAfter: string;
  checkOutBefore: string;
  smoking: RuleValue;
  pets: RuleValue;
  children: RuleValue;
  events: RuleValue;
}

const DRAFT_STORAGE_KEY = 'sutki-create-listing-draft-v1';
const ruleValues = new Set<RuleValue>(['', 'allowed', 'forbidden', 'on_request', 'on_balcony']);
const stringKeys = [
  'category',
  'rooms',
  'city',
  'street',
  'houseNumber',
  'area',
  'price',
  'maxGuests',
  'description',
  'checkInAfter',
  'checkOutBefore',
] as const;
const ruleKeys = ['smoking', 'pets', 'children', 'events'] as const;

export function createEmptyListingDraft(): CreateListingDraft {
  return {
    category: '',
    categoryIds: [],
    rooms: '',
    city: 'Челябинск',
    street: '',
    houseNumber: '',
    area: '',
    price: '',
    maxGuests: '',
    amenities: [],
    description: '',
    checkInAfter: '14:00',
    checkOutBefore: '12:00',
    smoking: '',
    pets: '',
    children: '',
    events: '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDraft(value: unknown): CreateListingDraft {
  const draft = createEmptyListingDraft();
  if (!isRecord(value)) return draft;

  for (const key of stringKeys) {
    if (typeof value[key] === 'string') draft[key] = value[key];
  }
  if (!draft.city.trim()) draft.city = 'Челябинск';

  for (const key of ruleKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && ruleValues.has(candidate as RuleValue)) {
      draft[key] = candidate as RuleValue;
    }
  }

  draft.amenities = Array.isArray(value.amenities)
    ? value.amenities.filter((item): item is string => typeof item === 'string')
    : [];
  draft.categoryIds = Array.isArray(value.categoryIds)
    ? value.categoryIds.filter((item): item is string => typeof item === 'string')
    : draft.category ? [draft.category] : [];
  draft.category = draft.categoryIds[0] ?? draft.category;

  return draft;
}

export function loadCreateListingDraft(): CreateListingDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? normalizeDraft(JSON.parse(raw) as unknown) : createEmptyListingDraft();
  } catch {
    return createEmptyListingDraft();
  }
}

export function saveCreateListingDraft(draft: CreateListingDraft): void {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Keep the current in-memory draft usable when storage is unavailable.
  }
}

export function clearCreateListingDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // The published flow may continue even in restricted browser modes.
  }
}

export function loadCreateListingTransientDraft(): CreateListingTransientDraft {
  return {
    photos: transientDraft.photos.map((photo) => ({ ...photo })),
    mapPoint: { ...transientDraft.mapPoint },
  };
}

export function saveCreateListingTransientDraft(next: CreateListingTransientDraft): void {
  transientDraft = {
    photos: next.photos.map((photo) => ({ ...photo })),
    mapPoint: { ...next.mapPoint },
  };
}

export function clearCreateListingTransientDraft(): void {
  transientDraft = { photos: [], mapPoint: { x: 57, y: 47 } };
}
