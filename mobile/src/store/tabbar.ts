import { create } from 'zustand';

interface TabBarState {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const useTabBarStore = create<TabBarState>((set) => ({
  visible: true,
  setVisible: (visible) => set({ visible }),
}));
