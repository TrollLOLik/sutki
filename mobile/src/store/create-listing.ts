import { create } from 'zustand';

/**
 * Draft state for the multi-step create-listing wizard. Photos are stored only
 * as local URIs for preview — they are NOT uploaded to the backend yet (media
 * phase is out of scope for this MVP).
 */
export interface CreateListingDraft {
  categoryIds: number[];
  /** Number of rooms, kept as a string to match the legacy schema. */
  countRoom: string;
  city: string;
  street: string;
  houseNumber: string;
  /** Area in m², entered as text and parsed on submit. */
  area: string;
  /** Price per night in rubles, entered as text and parsed on submit. */
  price: string;
  /** Max guests (sleeping capacity), entered as text and parsed on submit. */
  maxGuests: string;
  serviceIds: number[];
  description: string;
  /** Local image URIs for preview only. */
  photos: string[];
}

const emptyDraft: CreateListingDraft = {
  categoryIds: [],
  countRoom: '',
  city: '',
  street: '',
  houseNumber: '',
  area: '',
  price: '',
  maxGuests: '',
  serviceIds: [],
  description: '',
  photos: [],
};

interface CreateListingState extends CreateListingDraft {
  setField: <K extends keyof CreateListingDraft>(key: K, value: CreateListingDraft[K]) => void;
  toggleCategory: (id: number) => void;
  toggleService: (id: number) => void;
  addPhoto: (uri: string) => void;
  removePhoto: (uri: string) => void;
  reset: () => void;
}

function toggle(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export const useCreateListingStore = create<CreateListingState>((set) => ({
  ...emptyDraft,
  setField: (key, value) => set({ [key]: value } as Pick<CreateListingDraft, typeof key>),
  toggleCategory: (id) => set((s) => ({ categoryIds: toggle(s.categoryIds, id) })),
  toggleService: (id) => set((s) => ({ serviceIds: toggle(s.serviceIds, id) })),
  addPhoto: (uri) => set((s) => (s.photos.includes(uri) ? s : { photos: [...s.photos, uri] })),
  removePhoto: (uri) => set((s) => ({ photos: s.photos.filter((p) => p !== uri) })),
  reset: () => set(emptyDraft),
}));
