import { keepPreviousData, useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { RoomFilter, SearchFilters } from '@/store/filters';
import type { ListingDetail, ListingsPage } from '@/types/listing';

export interface ListListingsParams {
  limit?: number;
  offset?: number;
  /** Free-text query: matched against street, house number, description, city. */
  q?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  /** Exact room counts to match (e.g. [1, 2]). */
  rooms?: number[];
  /** Minimum room count, OR-combined with `rooms` (used for the "3+" bucket). */
  roomsMin?: number;
  /** Amenity service IDs; a listing must include all of them. */
  serviceIds?: number[];
  guests?: number;
  /** Availability window, YYYY-MM-DD. Both must be set to take effect. */
  checkIn?: string;
  checkOut?: string;
  sort?: string;
  petsAllowed?: boolean;
  childrenAllowed?: boolean;
  eventsAllowed?: boolean;
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
  if (params.q) sp.set('q', params.q);
  if (params.city) sp.set('city', params.city);
  if (params.priceMin != null) sp.set('price_min', String(params.priceMin));
  if (params.priceMax != null) sp.set('price_max', String(params.priceMax));
  if (params.rooms && params.rooms.length > 0) sp.set('rooms', params.rooms.join(','));
  if (params.roomsMin != null) sp.set('rooms_min', String(params.roomsMin));
  if (params.serviceIds && params.serviceIds.length > 0) {
    sp.set('services', params.serviceIds.join(','));
  }
  if (params.guests != null) sp.set('guests', String(params.guests));
  if (params.checkIn) sp.set('check_in', params.checkIn);
  if (params.checkOut) sp.set('check_out', params.checkOut);
  if (params.sort) sp.set('sort', params.sort);
  if (params.petsAllowed) sp.set('pets_allowed', 'true');
  if (params.childrenAllowed) sp.set('children_allowed', 'true');
  if (params.eventsAllowed) sp.set('events_allowed', 'true');
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Maps a RoomFilter chip to the backend rooms / rooms_min representation. */
function roomFilterToCount(room: RoomFilter): number | null {
  switch (room) {
    case 'studio':
      return 0;
    case '1':
      return 1;
    case '2':
      return 2;
    default:
      return null; // "3plus" is expressed via roomsMin
  }
}

/**
 * Translates the search-filters store + free-text query into the backend list
 * params. Server-side filtering replaces the old client-side `filterListings`.
 */
export function filtersToListParams(
  filters: SearchFilters,
  query: string,
  extra: Pick<ListListingsParams, 'limit' | 'offset'> = {},
): ListListingsParams {
  const rooms: number[] = [];
  let roomsMin: number | undefined;
  for (const r of filters.rooms) {
    if (r === '3plus') {
      roomsMin = 3;
    } else {
      const n = roomFilterToCount(r);
      if (n != null) rooms.push(n);
    }
  }

  const q = query.trim();
  return {
    ...extra,
    q: q.length > 0 ? q : undefined,
    city: filters.city ?? undefined,
    priceMin: filters.priceMin ?? undefined,
    priceMax: filters.priceMax ?? undefined,
    rooms: rooms.length > 0 ? rooms : undefined,
    roomsMin,
    serviceIds: filters.serviceIds.length > 0 ? filters.serviceIds : undefined,
    guests: filters.guests,
    checkIn: filters.checkIn && filters.checkOut ? filters.checkIn : undefined,
    checkOut: filters.checkIn && filters.checkOut ? filters.checkOut : undefined,
    petsAllowed: filters.petsAllowed || undefined,
    childrenAllowed: filters.childrenAllowed || undefined,
    eventsAllowed: filters.eventsAllowed || undefined,
  };
}

/** Listings are public, so no Authorization header is attached. */
export function fetchListings(params: ListListingsParams = {}): Promise<ListingsPage> {
  return api.get<ListingsPage>(`/api/v1/listings${buildQuery(params)}`, { auth: false });
}

export function fetchListing(id: number): Promise<ListingDetail> {
  return api.get<ListingDetail>(`/api/v1/listings/${id}`, { auth: false });
}

export function useListings(
  params: ListListingsParams = {},
  options: Pick<UseQueryOptions<ListingsPage>, 'enabled'> = {},
) {
  return useQuery({
    queryKey: listingKeys.list(params),
    queryFn: () => fetchListings(params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useListing(id: number | undefined) {
  return useQuery({
    queryKey: listingKeys.detail(id ?? 0),
    queryFn: () => fetchListing(id as number),
    enabled: id != null && id > 0,
  });
}
