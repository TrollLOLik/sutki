import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { ListingDetail, ListingsPage } from '@/types/listing';

export interface ListListingsParams {
  limit?: number;
  offset?: number;
}

export const listingKeys = {
  all: ['listings'] as const,
  list: (params: ListListingsParams) => [...listingKeys.all, 'list', params] as const,
  detail: (id: number) => [...listingKeys.all, 'detail', id] as const,
};

function buildQuery(params: ListListingsParams): string {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Listings are public, so no Authorization header is attached. */
export function fetchListings(params: ListListingsParams = {}): Promise<ListingsPage> {
  return api.get<ListingsPage>(`/api/v1/listings${buildQuery(params)}`, { auth: false });
}

export function fetchListing(id: number): Promise<ListingDetail> {
  return api.get<ListingDetail>(`/api/v1/listings/${id}`, { auth: false });
}

export function useListings(params: ListListingsParams = {}) {
  return useQuery({
    queryKey: listingKeys.list(params),
    queryFn: () => fetchListings(params),
    placeholderData: keepPreviousData,
  });
}

export function useListing(id: number | undefined) {
  return useQuery({
    queryKey: listingKeys.detail(id ?? 0),
    queryFn: () => fetchListing(id as number),
    enabled: id != null && id > 0,
  });
}
