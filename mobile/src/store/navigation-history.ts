import type { Href } from 'expo-router';
import { create } from 'zustand';

export const NAVIGATION_HISTORY_LIMIT = 12;
export const NAVIGATION_MENU_LIMIT = 6;
export const NAVIGATION_MENU_ROW_HEIGHT = 52;

export interface NavigationHistoryEntry {
  href: Href;
  key: string;
  title: string;
}

interface NavigationHistoryState {
  entries: NavigationHistoryEntry[];
  forwardRevisitKey: string | null;
  menuEntries: NavigationHistoryEntry[];
  menuOpen: boolean;
  selectedIndex: number | null;
  allowForwardRevisit: (key?: string) => void;
  clear: () => void;
  closeMenu: () => void;
  openMenu: () => void;
  record: (entry: NavigationHistoryEntry) => void;
  selectIndex: (index: number | null) => void;
  truncateTo: (key: string) => void;
}

export const useNavigationHistoryStore = create<NavigationHistoryState>((set, get) => ({
  entries: [],
  forwardRevisitKey: null,
  menuEntries: [],
  menuOpen: false,
  selectedIndex: null,

  allowForwardRevisit: (forwardRevisitKey) =>
    set({ forwardRevisitKey: forwardRevisitKey ?? '*' }),

  clear: () =>
    set({
      entries: [],
      forwardRevisitKey: null,
      menuEntries: [],
      menuOpen: false,
      selectedIndex: null,
    }),

  record: (entry) => {
    const entries = get().entries;
    const current = entries.at(-1);
    const pendingForwardKey = get().forwardRevisitKey;
    const isForwardRevisit =
      pendingForwardKey === '*' || pendingForwardKey === entry.key;

    if (isForwardRevisit) {
      const withoutOlderVisit = entries.filter((item) => item.key !== entry.key);
      set({
        entries: [...withoutOlderVisit, entry].slice(-NAVIGATION_HISTORY_LIMIT),
        forwardRevisitKey: null,
      });
      return;
    }

    if (current?.key === entry.key) {
      if (current.title !== entry.title) {
        set({ entries: [...entries.slice(0, -1), entry] });
      }
      if (get().forwardRevisitKey != null) set({ forwardRevisitKey: null });
      return;
    }

    const existingIndex = entries.findLastIndex((item) => item.key === entry.key);
    if (existingIndex >= 0) {
      set({
        entries: [...entries.slice(0, existingIndex), entry],
        forwardRevisitKey: null,
      });
      return;
    }

    set({
      entries: [...entries, entry].slice(-NAVIGATION_HISTORY_LIMIT),
      forwardRevisitKey: null,
    });
  },

  openMenu: () => {
    const menuEntries = get().entries.slice(0, -1).reverse().slice(0, NAVIGATION_MENU_LIMIT);
    if (menuEntries.length === 0) return;
    set({ menuEntries, menuOpen: true, selectedIndex: null });
  },

  closeMenu: () => set({ menuEntries: [], menuOpen: false, selectedIndex: null }),
  selectIndex: (selectedIndex) => set({ selectedIndex }),
  truncateTo: (key) => {
    const index = get().entries.findLastIndex((entry) => entry.key === key);
    if (index >= 0) set({ entries: get().entries.slice(0, index + 1) });
  },
}));
