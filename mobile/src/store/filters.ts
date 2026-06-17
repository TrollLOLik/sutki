import { create } from 'zustand';

export type RoomFilter = 'studio' | '1' | '2' | '3plus';
export type Amenity = 'wifi' | 'washer' | 'conditioner' | 'parking' | 'balcony';

export interface SearchFilters {
  city: string | null;
  district: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  priceMin: number | null;
  priceMax: number | null;
  rooms: RoomFilter[];
  amenities: Amenity[];
  /** When true, the feed shows only listings the user has favorited. */
  favoritesOnly: boolean;
}

export const defaultFilters: SearchFilters = {
  city: null,
  district: null,
  checkIn: null,
  checkOut: null,
  guests: 2,
  priceMin: null,
  priceMax: null,
  rooms: [],
  amenities: [],
  favoritesOnly: false,
};

interface FiltersState extends SearchFilters {
  setFilters: (patch: Partial<SearchFilters>) => void;
  toggleRoom: (room: RoomFilter) => void;
  toggleAmenity: (amenity: Amenity) => void;
  toggleFavoritesOnly: () => void;
  reset: () => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const useFiltersStore = create<FiltersState>((set) => ({
  ...defaultFilters,
  setFilters: (patch) => set(patch),
  toggleRoom: (room) => set((s) => ({ rooms: toggle(s.rooms, room) })),
  toggleAmenity: (amenity) => set((s) => ({ amenities: toggle(s.amenities, amenity) })),
  toggleFavoritesOnly: () => set((s) => ({ favoritesOnly: !s.favoritesOnly })),
  reset: () => set(defaultFilters),
}));
