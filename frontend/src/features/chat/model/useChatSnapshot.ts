import { useSyncExternalStore } from 'react';
import { chatRepository } from '../api';

export function useChatSnapshot() {
  return useSyncExternalStore(
    chatRepository.subscribe,
    chatRepository.getSnapshot,
    chatRepository.getSnapshot,
  );
}
