import { create } from 'zustand';
import { useSessionStore } from '@/store/session';

export type AuthGateContext = 'listing' | 'review' | 'favorites_cloud' | 'host' | 'generic';

interface AuthGateState {
  visible: boolean;
  context: AuthGateContext;
  openGate: (context: AuthGateContext) => void;
  closeGate: () => void;
}

export const useAuthGateStore = create<AuthGateState>((set) => ({
  visible: false,
  context: 'generic',
  openGate: (context) => set({ visible: true, context }),
  closeGate: () => set({ visible: false }),
}));

let globalFromBooking = false;
export const getGlobalFromBooking = () => globalFromBooking;
export const setGlobalFromBooking = (val: boolean) => {
  globalFromBooking = val;
};

export function requireAuth(context: AuthGateContext = 'generic'): boolean {
  const status = useSessionStore.getState().status;
  if (status === 'authenticated') {
    return true;
  }
  useAuthGateStore.getState().openGate(context);
  return false;
}
