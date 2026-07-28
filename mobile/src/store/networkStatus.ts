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
export const useNetworkStatusStore = create<NetworkStatusState>((set) => ({
  status: 'unknown',
  reportOnline: () =>
    set((state) => (state.status === 'online' ? state : { status: 'online' })),
  reportOffline: () =>
    set((state) => (state.status === 'offline' ? state : { status: 'offline' })),
}));
