import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { listingKeys } from '@/lib/api/listings';
import type { CreateReviewBody, Review, ReviewsPage } from '@/types/review';

export interface ListReviewsParams {
  limit?: number;
  offset?: number;
}

export const reviewKeys = {
  all: ['reviews'] as const,
  list: (houseId: number, params: ListReviewsParams) =>
    [...reviewKeys.all, houseId, 'list', params] as const,
};

function buildQuery(params: ListReviewsParams): string {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Reviews are public, so no Authorization header is attached. */
export function fetchReviews(houseId: number, params: ListReviewsParams = {}): Promise<ReviewsPage> {
  return api.get<ReviewsPage>(`/api/v1/listings/${houseId}/reviews${buildQuery(params)}`, {
    auth: false,
  });
}

export function createReview(houseId: number, body: CreateReviewBody): Promise<Review> {
  return api.post<Review>(`/api/v1/listings/${houseId}/reviews`, body);
}

export function useReviews(houseId: number | undefined, params: ListReviewsParams = {}) {
  return useQuery({
    queryKey: reviewKeys.list(houseId ?? 0, params),
    queryFn: () => fetchReviews(houseId as number, params),
    enabled: houseId != null && houseId > 0,
    placeholderData: keepPreviousData,
  });
}

export function useCreateReview(houseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReviewBody) => createReview(houseId, body),
    onSuccess: () => {
      // Refresh the reviews list/summary and any listing card that shows the
      // (now changed) aggregate rating.
      qc.invalidateQueries({ queryKey: reviewKeys.all });
      qc.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}
