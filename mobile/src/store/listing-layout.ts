import { create } from 'zustand';

import { SECURE_KEYS, secureStorage } from '@/lib/secure-storage';

export type ListingLayoutMode = 'list' | 'grid';
export type ListingLayoutScope = 'discovery' | 'mine';

interface StoredLayoutPreference {
  discovery: ListingLayoutMode;
  mine: ListingLayoutMode;
}

interface ListingLayoutState extends StoredLayoutPreference {
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (scope: ListingLayoutScope, mode: ListingLayoutMode) => void;
  toggleMode: (scope: ListingLayoutScope) => void;
}

const defaults: StoredLayoutPreference = {
  discovery: 'list',
  mine: 'list',
};

function isLayoutMode(value: unknown): value is ListingLayoutMode {
  return value === 'list' || value === 'grid';
}

function persistPreference(preference: StoredLayoutPreference) {
  secureStorage
    .set(SECURE_KEYS.listingLayoutPreference, JSON.stringify(preference))
    .catch(() => undefined);
}

export const useListingLayoutStore = create<ListingLayoutState>((set, get) => ({
  ...defaults,
  hasHydrated: false,

  hydrate: async () => {
    const raw = await secureStorage.get(SECURE_KEYS.listingLayoutPreference).catch(() => null);
    if (!raw) {
      set({ ...defaults, hasHydrated: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredLayoutPreference>;
      set({
        discovery: isLayoutMode(parsed.discovery) ? parsed.discovery : defaults.discovery,
        mine: isLayoutMode(parsed.mine) ? parsed.mine : defaults.mine,
        hasHydrated: true,
      });
    } catch {
      set({ ...defaults, hasHydrated: true });
    }
  },

  setMode: (scope, mode) => {
    set({ [scope]: mode });
    const next = {
      discovery: scope === 'discovery' ? mode : get().discovery,
      mine: scope === 'mine' ? mode : get().mine,
    };
    persistPreference(next);
  },

  toggleMode: (scope) => {
    const mode = get()[scope] === 'list' ? 'grid' : 'list';
    get().setMode(scope, mode);
  },
}));
