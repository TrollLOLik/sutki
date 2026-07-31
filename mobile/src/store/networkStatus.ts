import { create } from 'zustand';

export type NetworkStatus = 'unknown' | 'online' | 'offline';

interface NetworkStatusState {
  status: NetworkStatus;
  reportOnline: () => void;
  reportOffline: () => void;
}

/**
 * Combines native connectivity signals with actual API request results.
 *
 * Android may keep reporting an active Wi-Fi/mobile interface while requests
 * already fail. A failed fetch is therefore allowed to mark the app offline,
 * while any completed HTTP response proves that the API is reachable again.
 */
export const useNetworkStatusStore = create<NetworkStatusState>((set, get) => ({
  status: 'unknown',
  reportOnline: () => {
    if (get().status !== 'online') set({ status: 'online' });
  },
  reportOffline: () => {
    if (get().status !== 'offline') set({ status: 'offline' });
  },
}));
