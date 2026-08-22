import { reviewSeed } from './seed';
import { sessionEvents } from '@shared/api';
import { REVIEW_BODY_LIMIT, REVIEW_MAX_ATTEMPTS, isReviewEditable } from '../model/reviewRules';
import type { Review, ReviewReply, ReviewsSnapshot, SubmitReviewInput } from '../model/types';

const cloneSeed = (): Review[] => reviewSeed.map((review) => ({ ...review, listing: { ...review.listing }, reply: review.reply ? { ...review.reply } : undefined }));
let reviews = cloneSeed();
let snapshot: ReviewsSnapshot = { reviews };
const listeners = new Set<() => void>();

function commit(next: Review[]): void {
  reviews = next;
  snapshot = { reviews };
  listeners.forEach((listener) => listener());
}

function validateBody(body: string): string {
  const value = body.trim();
  if (!value) throw new Error('Расскажите подробнее о проживании');
  if (value.length > REVIEW_BODY_LIMIT) throw new Error(`Максимум ${REVIEW_BODY_LIMIT} символов`);
  return value;
}

export const reviewRepository = {
  getSnapshot: (): ReviewsSnapshot => snapshot,
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  getByRequestId(requestId: number): Review | undefined { return reviews.find((review) => review.requestId === requestId); },
  async submit(input: SubmitReviewInput): Promise<Review> {
    const rating = Math.round(input.rating);
    if (rating < 1 || rating > 5) throw new Error('Поставьте оценку от 1 до 5');
    const body = validateBody(input.body);
    const existing = reviews.find((review) => review.requestId === input.requestId);
    if (existing) {
      if (!isReviewEditable(existing)) throw new Error('Этот отзыв нельзя изменить');
      if (existing.rating === rating && existing.body === body) throw new Error('Измените оценку или текст отзыва');
      const updated: Review = { ...existing, rating: rating as Review['rating'], body, status: 'pending_moderation', rejectionReason: undefined, editAttempts: existing.editAttempts + 1, createdAt: new Date().toISOString() };
      commit(reviews.map((review) => review.id === updated.id ? updated : review));
      sessionEvents.emit('review:changed', { source: 'reviews', reviewId: updated.id, action: 'updated' });
      return updated;
    }
    const created: Review = {
      id: Math.max(0, ...reviews.map((review) => review.id)) + 1,
      requestId: input.requestId,
      rating: rating as Review['rating'], body,
      authorId: 'me', authorName: 'Артём Иванов', createdAt: new Date().toISOString(),
      status: 'pending_moderation', editAttempts: 0, maxAttempts: REVIEW_MAX_ATTEMPTS,
      listing: { ...input.listing }, writtenByMe: true, receivedByMe: false,
    };
    commit([created, ...reviews]);
    sessionEvents.emit('review:changed', { source: 'reviews', reviewId: created.id, action: 'submitted' });
    return created;
  },
  async reply(reviewId: number, rawBody: string): Promise<ReviewReply> {
    const body = validateBody(rawBody);
    const review = reviews.find((item) => item.id === reviewId);
    if (!review || !review.receivedByMe) throw new Error('Отзыв не найден');
    if (review.reply) throw new Error('Ответ на этот отзыв уже отправлен');
    const reply: ReviewReply = { id: Date.now(), body, status: 'pending_moderation', createdAt: new Date().toISOString() };
    commit(reviews.map((item) => item.id === reviewId ? { ...item, reply } : item));
    sessionEvents.emit('review:changed', { source: 'reviews', reviewId, action: 'replied' });
    return reply;
  },
  async delete(reviewId: number): Promise<void> {
    const review = reviews.find((item) => item.id === reviewId);
    if (!review || !review.writtenByMe) throw new Error('Отзыв не найден');
    commit(reviews.map((item) => item.id === reviewId ? { ...item, status: 'deleted' } : item));
  },
  reset(): void { commit(cloneSeed()); },
};

sessionEvents.subscribe('session:reset', ({ source }) => {
  if (source !== 'reviews') reviewRepository.reset();
});
