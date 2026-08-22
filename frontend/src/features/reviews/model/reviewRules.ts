import type { Review, ReviewSort, ReviewStatus } from './types';

export const REVIEW_BODY_LIMIT = 1500;
export const REVIEW_MAX_ATTEMPTS = 3;
export const REVIEW_RATING_LABELS = ['Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично!'] as const;

export function reviewStatusLabel(status: ReviewStatus): string {
  if (status === 'active') return 'Опубликован';
  if (status === 'rejected') return 'Отклонён';
  if (status === 'moderation_review') return 'Дополнительная проверка';
  if (status === 'deleted') return 'Удалён';
  return 'На проверке';
}

export function isReviewEditable(review: Review): boolean {
  return ['rejected', 'moderation_review'].includes(review.status) && review.editAttempts < review.maxAttempts;
}

export function remainingReviewAttempts(review: Review): number {
  return Math.max(0, review.maxAttempts - review.editAttempts);
}

export function filterAndSortReviews(reviews: Review[], query: string, sort: ReviewSort): Review[] {
  const needle = query.trim().toLocaleLowerCase('ru-RU');
  return reviews
    .filter((review) => !needle || [review.body, review.authorName, review.listing.address, review.listing.city, review.listing.title]
      .some((value) => value.toLocaleLowerCase('ru-RU').includes(needle)))
    .sort((left, right) => {
      if (sort === 'rating_desc') return right.rating - left.rating;
      if (sort === 'rating_asc') return left.rating - right.rating;
      const delta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return sort === 'oldest' ? -delta : delta;
    });
}

export function reviewSummary(reviews: Review[]) {
  const active = reviews.filter((review) => review.status === 'active');
  const distribution = [5, 4, 3, 2, 1].map((rating) => active.filter((review) => review.rating === rating).length);
  const average = active.length ? active.reduce((sum, review) => sum + review.rating, 0) / active.length : 0;
  return { average, total: active.length, distribution };
}
