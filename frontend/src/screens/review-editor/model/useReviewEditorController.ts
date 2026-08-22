import { useMemo, useState } from 'react';
import { requestRepository, useRequestsSnapshot } from '@features/requests';
import {
  REVIEW_RATING_LABELS,
  isReviewEditable,
  reviewRepository,
  useReviewsSnapshot,
} from '@features/reviews';

export function useReviewEditorController(requestId: number) {
  const { requests } = useRequestsSnapshot();
  useReviewsSnapshot();
  const requestRecord = requests.find((item) => item.id === requestId && item.direction === 'outgoing');
  const existing = reviewRepository.getByRequestId(requestId);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const request = requestRecord?.status === 'completed' && (busy || submitted || (!existing && requestRecord.reviewAvailable) || (existing && isReviewEditable(existing))) ? requestRecord : undefined;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState('');
  const editing = Boolean(existing && isReviewEditable(existing));
  const title = editing ? 'Изменить отзыв' : 'Оставить отзыв';
  const hint = rating < 1 ? 'Поставьте оценку жилью' : body.trim().length === 0 ? 'Добавьте несколько слов о проживании' : 'Отзыв появится после проверки';
  const ratingLabel = useMemo(() => rating ? REVIEW_RATING_LABELS[rating - 1] : 'Нажмите на звезду', [rating]);
  const ratingError = error && rating < 1 ? error : undefined;
  const bodyError = error && rating >= 1 && body.trim().length === 0 ? error : undefined;
  const submissionError = error && !ratingError && !bodyError ? error : undefined;

  const submit = async () => {
    if (!request) return;
    if (rating < 1) {
      setError('Поставьте оценку жилью');
      return;
    }
    if (!body.trim()) {
      setError('Добавьте несколько слов о проживании');
      return;
    }

    setError('');
    setBusy(true);
    try {
      const review = await reviewRepository.submit({
        requestId: request.id,
        rating,
        body,
        listing: {
          id: request.listing.id,
          title: request.listing.title,
          address: request.listing.address,
          city: request.listing.city,
          coverUrl: request.listing.coverUrl,
          ownerId: ({ 11: 'anna', 12: 'mikhail', 13: 'elena' } as Record<number, string>)[request.listing.owner.id] ?? String(request.listing.owner.id),
        },
      });
      if (review.status !== 'deleted') requestRepository.syncReview(request.id, review.status);
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось отправить отзыв. Пожалуйста, попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return {
    request,
    existing,
    busy,
    submitted,
    rating,
    setRating,
    body,
    setBody,
    setError,
    editing,
    title,
    hint,
    ratingLabel,
    ratingError,
    bodyError,
    submissionError,
    submit,
  };
}

export type ReviewEditorController = ReturnType<typeof useReviewEditorController>;
