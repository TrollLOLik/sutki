import { useSyncExternalStore } from 'react';
import { requestRepository } from '../api';

export function useRequestsSnapshot() {
  return useSyncExternalStore(
    requestRepository.subscribe,
    requestRepository.getSnapshot,
    requestRepository.getSnapshot,
  );
}
