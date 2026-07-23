import { create } from 'zustand';

import { SECURE_KEYS, secureStorage } from '@/lib/secure-storage';

export type RoomFilter = 'studio' | '1' | '2' | '3' | '4' | '5plus';
export type ListingSort = 'newest' | 'oldest' | 'popular';
export type MyListingStatus = 'active' | 'unpublished' | 'pending_moderation' | 'moderation_review' | 'rejected';
export type CitySelectionSource = 'unset' | 'profile' | 'manual';

export interface SearchFilters {
  sort: ListingSort;
  /** City name (matches house.country on the backend). */
  city: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  rooms: RoomFilter[];
  categoryId: number | null;
  /** Selected amenity service IDs from the /services catalog. */
  serviceIds: number[];
  /** When true, the feed shows only listings the user has favorited. */
  favoritesOnly: boolean;
  /** When true, the authenticated user's listings remain visible in the main feed. */
  showOwnListings: boolean;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  childrenAllowed: boolean;
  eventsAllowed: boolean;
}

export const defaultFilters: SearchFilters = {
  sort: 'newest',
  city: null,
  checkIn: null,
  checkOut: null,
  guests: 1,
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  rooms: [],
  categoryId: null,
  serviceIds: [],
  favoritesOnly: false,
  showOwnListings: false,
  smokingAllowed: false,
  petsAllowed: false,
  childrenAllowed: false,
  eventsAllowed: false,
};

interface FiltersState extends SearchFilters {
  citySource: CitySelectionSource;
  cityHydrated: boolean;
  hydrateCity: (profileCity?: string | null) => Promise<void>;
  applyProfileCityIfUnset: (profileCity?: string | null) => void;
  setFilters: (patch: Partial<SearchFilters>) => void;
  toggleRoom: (room: RoomFilter) => void;
  toggleService: (id: number) => void;
  toggleFavoritesOnly: () => void;
  /** Resets everything except favoritesOnly (a separate UI toggle). */
  resetSearch: () => void;
  reset: () => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface StoredCityPreference {
  city: string | null;
  source: 'manual';
}

function persistManualCity(city: string | null) {
  const preference: StoredCityPreference = { city, source: 'manual' };
  secureStorage
    .set(SECURE_KEYS.searchCityPreference, JSON.stringify(preference))
    .catch(() => undefined);
}

function readStoredCityPreference(raw: string | null): StoredCityPreference | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredCityPreference>;
    if (
      parsed.source === 'manual' &&
      (parsed.city === null || typeof parsed.city === 'string')
    ) {
      return { source: 'manual', city: parsed.city };
    }
  } catch {
    // Ignore a damaged preference and fall back to the profile city.
  }
  return null;
}

export const useFiltersStore = create<FiltersState>((set, get) => ({
  ...defaultFilters,
  citySource: 'unset',
  cityHydrated: false,
  hydrateCity: async (profileCity) => {
    const raw = await secureStorage.get(SECURE_KEYS.searchCityPreference).catch(() => null);
    const stored = readStoredCityPreference(raw);
    if (stored) {
      set({ city: stored.city, citySource: 'manual', cityHydrated: true });
      return;
    }
    const normalizedProfileCity = profileCity?.trim() || null;
    set({
      city: normalizedProfileCity,
      citySource: normalizedProfileCity ? 'profile' : 'unset',
      cityHydrated: true,
    });
  },
  applyProfileCityIfUnset: (profileCity) => {
    const normalizedProfileCity = profileCity?.trim() || null;
    const state = get();
    if (state.citySource === 'manual') return;
    if (normalizedProfileCity) {
      set({ city: normalizedProfileCity, citySource: 'profile' });
      return;
    }
    if (state.citySource === 'profile') {
      set({ city: null, citySource: 'unset' });
    }
  },
  setFilters: (patch) => {
    if (Object.prototype.hasOwnProperty.call(patch, 'city')) {
      const city = patch.city?.trim() || null;
      set({ ...patch, city, citySource: 'manual' });
      persistManualCity(city);
      return;
    }
    set(patch);
  },
  toggleRoom: (room) => set((s) => ({ rooms: toggle(s.rooms, room) })),
  toggleService: (id) => set((s) => ({ serviceIds: toggle(s.serviceIds, id) })),
  toggleFavoritesOnly: () => set((s) => ({ favoritesOnly: !s.favoritesOnly })),
  resetSearch: () =>
    set((s) => {
      persistManualCity(null);
      return {
        ...defaultFilters,
        favoritesOnly: s.favoritesOnly,
        citySource: 'manual',
        cityHydrated: s.cityHydrated,
      };
    }),
  reset: () => {
    persistManualCity(null);
    set((state) => ({
      ...defaultFilters,
      citySource: 'manual',
      cityHydrated: state.cityHydrated,
    }));
  },
}));

export interface MyListingFilters extends SearchFilters {
  statuses: MyListingStatus[];
}

interface MyListingFiltersState extends MyListingFilters {
  setFilters: (patch: Partial<MyListingFilters>) => void;
  reset: () => void;
}

const defaultMyListingFilters: MyListingFilters = {
  ...defaultFilters,
  statuses: [],
};

export const useMyListingFiltersStore = create<MyListingFiltersState>((set) => ({
  ...defaultMyListingFilters,
  setFilters: (patch) => set(patch),
  reset: () => set(defaultMyListingFilters),
}));

/**
 * Counts the active search constraints (everything except favoritesOnly and
 * the free-text query) for the filters badge.
 */
export function countActiveFilters(f: SearchFilters): number {
  return (
    f.rooms.length +
    f.serviceIds.length +
    (f.city != null ? 1 : 0) +
    (f.checkIn != null && f.checkOut != null ? 1 : 0) +
    (f.priceMin != null || f.priceMax != null ? 1 : 0) +
    (f.areaMin != null || f.areaMax != null ? 1 : 0) +
    (f.categoryId != null ? 1 : 0) +
    (f.guests !== defaultFilters.guests ? 1 : 0) +
    (f.smokingAllowed ? 1 : 0) +
    (f.petsAllowed ? 1 : 0) +
    (f.childrenAllowed ? 1 : 0) +
    (f.eventsAllowed ? 1 : 0)
  );
}
