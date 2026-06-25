import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { listingKeys } from '@/lib/api/listings';
import type { CreateReviewBody, Review, ReviewsPage, UserReviewsPage } from '@/types/review';

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

export const hostReviewKeys = {
  all: ['host-reviews'] as const,
  list: (hostId: number, params: ListReviewsParams) =>
    [...hostReviewKeys.all, hostId, 'list', params] as const,
};

export function fetchHostReviews(hostId: number, params: ListReviewsParams = {}): Promise<ReviewsPage> {
  return api.get<ReviewsPage>(`/api/v1/users/${hostId}/reviews${buildQuery(params)}`, {
    auth: false,
  });
}

export function useHostReviews(hostId: number | undefined, params: ListReviewsParams = {}) {
  return useQuery({
    queryKey: hostReviewKeys.list(hostId ?? 0, params),
    queryFn: () => fetchHostReviews(hostId as number, params),
    enabled: hostId != null && hostId > 0,
    staleTime: 5 * 60 * 1000,
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

export const myReviewKeys = {
  all: ['my-reviews'] as const,
  written: (params: ListReviewsParams) => [...myReviewKeys.all, 'written', params] as const,
  received: (params: ListReviewsParams) => [...myReviewKeys.all, 'received', params] as const,
};

export function fetchMyWrittenReviews(params: ListReviewsParams = {}): Promise<UserReviewsPage> {
  return api.get<UserReviewsPage>(`/api/v1/me/reviews/written${buildQuery(params)}`);
}

export function fetchMyReceivedReviews(params: ListReviewsParams = {}): Promise<UserReviewsPage> {
  return api.get<UserReviewsPage>(`/api/v1/me/reviews/received${buildQuery(params)}`);
}

export function useMyWrittenReviews(params: ListReviewsParams = {}, enabled = true) {
  return useQuery({
    queryKey: myReviewKeys.written(params),
    queryFn: () => fetchMyWrittenReviews(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useMyReceivedReviews(params: ListReviewsParams = {}, enabled = true) {
  return useQuery({
    queryKey: myReviewKeys.received(params),
    queryFn: () => fetchMyReceivedReviews(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

