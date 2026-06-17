import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { listingKeys, type ListListingsParams } from '@/lib/api/listings';
import type { ListingDetail, ListingRef, ListingsPage } from '@/types/listing';

/** Payload for POST /api/v1/listings. OwnerID is taken from the session. */
export interface NewListingInput {
  street: string;
  house_number: string;
  city: string;
  description: string;
  /** Price per night, in rubles. */
  price: number;
  /** Number of rooms, kept as a string to match the legacy schema. */
  count_room: string;
  number_room?: string | null;
  /** Area in square meters. */
  area: number;
  lat?: number | null;
  lng?: number | null;
  service_ids: number[];
  category_ids: number[];
}

interface RefResponse {
  items: ListingRef[];
}

export const catalogKeys = {
  services: ['catalog', 'services'] as const,
  categories: ['catalog', 'categories'] as const,
};

/** Amenity catalog (used both for filters and the create-listing form). */
export function useServices() {
  return useQuery({
    queryKey: catalogKeys.services,
    queryFn: async () => (await api.get<RefResponse>('/api/v1/services', { auth: false })).items,
    staleTime: 1000 * 60 * 60,
  });
}

/** Listing-type catalog (e.g. квартира, дом). */
export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: async () => (await api.get<RefResponse>('/api/v1/categories', { auth: false })).items,
    staleTime: 1000 * 60 * 60,
  });
}

/** Publishes a new listing. Invalidates the public feed and "Мои объявления". */
export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewListingInput) =>
      api.post<ListingDetail>('/api/v1/listings', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.all });
      qc.invalidateQueries({ queryKey: myListingKeys.all });
    },
  });
}

export const myListingKeys = {
  all: ['my-listings'] as const,
  list: (params: ListListingsParams) => [...myListingKeys.all, params] as const,
};

/** The authenticated user's own listings (any status), newest first. */
export function useMyListings(params: ListListingsParams = {}) {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const qs = sp.toString();
  return useQuery({
    queryKey: myListingKeys.list(params),
    queryFn: () => api.get<ListingsPage>(`/api/v1/listings/mine${qs ? `?${qs}` : ''}`),
  });
}
