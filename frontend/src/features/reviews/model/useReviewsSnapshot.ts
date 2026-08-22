import { useSyncExternalStore } from 'react';
import { reviewRepository } from '../api/reviewRepository';

export function useReviewsSnapshot() {
  return useSyncExternalStore(reviewRepository.subscribe, reviewRepository.getSnapshot, reviewRepository.getSnapshot);
}