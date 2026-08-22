import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortReviews, isReviewEditable, remainingReviewAttempts, reviewStatusLabel, reviewSummary } from '../src/features/reviews/model/reviewRules.ts';

const base = { id: 1, requestId: 9174, rating: 3, body: 'Чистая квартира', authorId: 'me', authorName: 'Артём', createdAt: '2026-07-01T10:00:00Z', status: 'rejected', rejectionReason: 'Исправьте текст', editAttempts: 1, maxAttempts: 3, listing: { id: 3, title: 'Квартира', address: 'ул. Зелёный Лог, 39', city: 'Магнитогорск', ownerId: 'mikhail' }, writtenByMe: true, receivedByMe: false };

test('only rejected and moderation-review items with attempts left can be edited', () => {
  assert.equal(isReviewEditable(base), true);
  assert.equal(remainingReviewAttempts(base), 2);
  assert.equal(isReviewEditable({ ...base, status: 'moderation_review' }), true);
  assert.equal(isReviewEditable({ ...base, status: 'active' }), false);
  assert.equal(isReviewEditable({ ...base, status: 'deleted' }), false);
  assert.equal(isReviewEditable({ ...base, editAttempts: 3 }), false);
});

test('moderation statuses keep the same user-facing wording as the app', () => {
  assert.equal(reviewStatusLabel('pending_moderation'), 'На проверке');
  assert.equal(reviewStatusLabel('moderation_review'), 'Дополнительная проверка');
  assert.equal(reviewStatusLabel('rejected'), 'Отклонён');
  assert.equal(reviewStatusLabel('active'), 'Опубликован');
  assert.equal(reviewStatusLabel('deleted'), 'Удалён');
});

test('reviews filter across text and address and sort by rating or date', () => {
  const second = { ...base, id: 2, rating: 5, body: 'Удобное заселение', createdAt: '2026-07-03T10:00:00Z', status: 'active', listing: { ...base.listing, address: 'ул. Гагарина, 22' } };
  assert.deepEqual(filterAndSortReviews([base, second], 'Гагарина', 'newest').map((item) => item.id), [2]);
  assert.deepEqual(filterAndSortReviews([base, second], '', 'rating_desc').map((item) => item.id), [2, 1]);
  assert.deepEqual(filterAndSortReviews([base, second], '', 'oldest').map((item) => item.id), [1, 2]);
});

test('summary includes only active reviews and builds a five-star distribution', () => {
  const reviews = [{ ...base, status: 'active', rating: 4 }, { ...base, id: 2, status: 'active', rating: 5 }, { ...base, id: 3, status: 'pending_moderation', rating: 1 }];
  const summary = reviewSummary(reviews);
  assert.equal(summary.total, 2);
  assert.equal(summary.average, 4.5);
  assert.deepEqual(summary.distribution, [1, 1, 0, 0, 0]);
});
