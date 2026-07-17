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
  areaMin?: number;
  areaMax?: number;
  /** Exact room counts to match (e.g. [1, 2]). */
  rooms?: number[];
  /** Minimum room count, OR-combined with `rooms` (used for the "3+" bucket). */
  roomsMin?: number;
  /** Amenity service IDs; a listing must include all of them. */
  serviceIds?: number[];
  categoryId?: number;
  ownerId?: number;
  guests?: number;
  /** Availability window, YYYY-MM-DD. Both must be set to take effect. */
  checkIn?: string;
  checkOut?: string;
  sort?: string;
  smokingAllowed?: boolean;
  petsAllowed?: boolean;
  childrenAllowed?: boolean;
  eventsAllowed?: boolean;
  houseIds?: number[];
  /** Bounding box search: "minLng,minLat,maxLng,maxLat" */
  bbox?: string;
}

export const listingKeys = {
  all: ['listings'] as const,
  list: (params: ListListingsParams) => [...listingKeys.all, 'list', params] as const,
  detail: (id: number) => [...listingKeys.all, 'detail', id] as const,
};

export interface MapCluster {
  city: string;
  lat: number;
  lng: number;
  count: number;
}

export function useMapClusters(enabled = true) {
  return useQuery({
    queryKey: [...listingKeys.all, 'map-clusters'],
    queryFn: () => api.get<{ items: MapCluster[] }>('/api/v1/listings/map-clusters', { auth: false }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

function buildQuery(params: ListListingsParams): string {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  if (params.q) sp.set('q', params.q);
  if (params.city) sp.set('city', params.city);
  if (params.priceMin != null) sp.set('price_min', String(params.priceMin));
  if (params.priceMax != null) sp.set('price_max', String(params.priceMax));
  if (params.areaMin != null) sp.set('area_min', String(params.areaMin));
  if (params.areaMax != null) sp.set('area_max', String(params.areaMax));
  if (params.rooms && params.rooms.length > 0) sp.set('rooms', params.rooms.join(','));
  if (params.roomsMin != null) sp.set('rooms_min', String(params.roomsMin));
  if (params.serviceIds && params.serviceIds.length > 0) {
    sp.set('services', params.serviceIds.join(','));
  }
  if (params.categoryId != null) sp.set('category', String(params.categoryId));
  if (params.ownerId != null) sp.set('owner_id', String(params.ownerId));
  if (params.houseIds && params.houseIds.length > 0) {
    sp.set('house_ids', params.houseIds.join(','));
  }
  if (params.guests != null) sp.set('guests', String(params.guests));
  if (params.checkIn) sp.set('check_in', params.checkIn);
  if (params.checkOut) sp.set('check_out', params.checkOut);
  if (params.sort) sp.set('sort', params.sort);
  if (params.smokingAllowed) sp.set('smoking_allowed', 'true');
  if (params.petsAllowed) sp.set('pets_allowed', 'true');
  if (params.childrenAllowed) sp.set('children_allowed', 'true');
  if (params.eventsAllowed) sp.set('events_allowed', 'true');
  if (params.bbox) sp.set('bbox', params.bbox);
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
    case '3':
      return 3;
    case '4':
      return 4;
    default:
      return null; // "5plus" is expressed via roomsMin
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
    if (r === '5plus') {
      roomsMin = 5;
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
    areaMin: filters.areaMin ?? undefined,
    areaMax: filters.areaMax ?? undefined,
    rooms: rooms.length > 0 ? rooms : undefined,
    roomsMin,
    serviceIds: filters.serviceIds.length > 0 ? filters.serviceIds : undefined,
    categoryId: filters.categoryId ?? undefined,
    guests: filters.guests,
    checkIn: filters.checkIn && filters.checkOut ? filters.checkIn : undefined,
    checkOut: filters.checkIn && filters.checkOut ? filters.checkOut : undefined,
    smokingAllowed: filters.smokingAllowed || undefined,
    petsAllowed: filters.petsAllowed || undefined,
    childrenAllowed: filters.childrenAllowed || undefined,
    eventsAllowed: filters.eventsAllowed || undefined,
    sort: filters.sort,
  };
}

/**
 * Builds the fallback query shown when the exact search has no matches.
 * Location, category, capacity and availability stay strict because relaxing
 * them could produce an unusable booking. Presentation preferences are soft.
 */
export function similarFiltersToListParams(
  filters: SearchFilters,
  query: string,
  extra: Pick<ListListingsParams, 'limit' | 'offset'> = {},
): ListListingsParams {
  const exact = filtersToListParams(filters, query, extra);
  return {
    ...extra,
    q: exact.q,
    city: exact.city,
    categoryId: exact.categoryId,
    guests: exact.guests,
    checkIn: exact.checkIn,
    checkOut: exact.checkOut,
    sort: exact.sort,
  };
}

export interface RecordListingViewResult {
  counted: boolean;
  views: number;
}

export function recordListingView(id: number, eventId: string): Promise<RecordListingViewResult> {
  return api.post<RecordListingViewResult>(`/api/v1/listings/${id}/views`, { event_id: eventId });
}

/** Listings are public, so no Authorization header is attached. */
export function fetchListings(
  params: ListListingsParams = {},
  signal?: AbortSignal,
): Promise<ListingsPage> {
  return api.get<ListingsPage>(`/api/v1/listings${buildQuery(params)}`, { auth: false, signal });
}

export function fetchListing(id: number): Promise<ListingDetail> {
  return api.get<ListingDetail>(`/api/v1/listings/${id}`);
}

export function useListings(
  params: ListListingsParams = {},
  options: Pick<UseQueryOptions<ListingsPage>, 'enabled'> = {},
) {
  return useQuery({
    queryKey: listingKeys.list(params),
    queryFn: ({ signal }) => fetchListings(params, signal),
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
