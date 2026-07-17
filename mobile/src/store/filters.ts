import { create } from 'zustand';

export type RoomFilter = 'studio' | '1' | '2' | '3' | '4' | '5plus';
export type ListingSort = 'newest' | 'oldest' | 'popular';

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
  smokingAllowed: false,
  petsAllowed: false,
  childrenAllowed: false,
  eventsAllowed: false,
};

interface FiltersState extends SearchFilters {
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

export const useFiltersStore = create<FiltersState>((set) => ({
  ...defaultFilters,
  setFilters: (patch) => set(patch),
  toggleRoom: (room) => set((s) => ({ rooms: toggle(s.rooms, room) })),
  toggleService: (id) => set((s) => ({ serviceIds: toggle(s.serviceIds, id) })),
  toggleFavoritesOnly: () => set((s) => ({ favoritesOnly: !s.favoritesOnly })),
  resetSearch: () =>
    set((s) => ({ ...defaultFilters, favoritesOnly: s.favoritesOnly })),
  reset: () => set(defaultFilters),
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
