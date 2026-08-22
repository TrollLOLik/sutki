import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchPublicListing,
  fetchPublicListings,
  filtersToPublicListingParams,
  type PublicListingReferences,
  type PublicListingSource,
} from '@shared/api/publicListings';
import { runtimeConfig } from '@shared/config/runtime';
import { listings as mockListings, type Listing } from '@shared/data/listings';
import { countActiveFilters, defaultFilters, toggleItem, type RoomFilter, type SearchFilters } from '@shared/types/filters';

function listingRoom(listing: Listing): RoomFilter {
  if (listing.rooms === 0) return 'studio';
  if (listing.rooms >= 5) return '5plus';
  return `${listing.rooms}` as RoomFilter;
}

function matches(item: Listing, filters: SearchFilters, query: string, favorites: Set<number>, ignoreOwnership = false): boolean {
  const normalized = query.trim().toLocaleLowerCase('ru');
  if (normalized && !`${item.title} ${item.address} ${item.city} ${item.cityName}`.toLocaleLowerCase('ru').includes(normalized)) return false;
  if (filters.rooms.length && !filters.rooms.includes(listingRoom(item))) return false;
  if (filters.favoritesOnly && !favorites.has(item.id)) return false;
  if (!ignoreOwnership && !filters.showOwnListings && item.isOwn) return false;
  if (filters.city && item.cityName !== filters.city) return false;
  if (filters.priceMin != null && item.price < filters.priceMin) return false;
  if (filters.priceMax != null && item.price > filters.priceMax) return false;
  if (filters.areaMin != null && item.area < filters.areaMin) return false;
  if (filters.areaMax != null && item.area > filters.areaMax) return false;
  if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
  if (filters.guests > item.capacity) return false;
  if (filters.serviceIds.some((service) => !item.serviceIds.includes(service))) return false;
  if (filters.smokingAllowed && !item.smokingAllowed) return false;
  if (filters.petsAllowed && !item.petsAllowed) return false;
  if (filters.childrenAllowed && !item.childrenAllowed) return false;
  if (filters.eventsAllowed && !item.eventsAllowed) return false;
  if (filters.checkIn && filters.checkOut && (item.availableFrom > filters.checkIn || item.availableTo < filters.checkOut)) return false;
  return true;
}

function matchesSimilar(item: Listing, filters: SearchFilters, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('ru');
  if (normalized && !`${item.title} ${item.address} ${item.city} ${item.cityName}`.toLocaleLowerCase('ru').includes(normalized)) return false;
  if (!filters.showOwnListings && item.isOwn) return false;
  if (filters.city && item.cityName !== filters.city) return false;
  if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
  if (filters.guests > item.capacity) return false;
  if (filters.checkIn && filters.checkOut && (item.availableFrom > filters.checkIn || item.availableTo < filters.checkOut)) return false;
  return true;
}

function sortItems(items: Listing[], sort: SearchFilters['sort']): Listing[] {
  return [...items].sort((a, b) => {
    if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt);
    if (sort === 'popular') return b.views - a.views || b.rating - a.rating;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function filterListingCollection(
  source: readonly Listing[],
  filters: SearchFilters,
  query: string,
  favorites: Set<number>,
  options: { ignoreOwnership?: boolean } = {},
): Listing[] {
  return sortItems(source.filter((item) => matches(item, filters, query, favorites, options.ignoreOwnership)), filters.sort);
}

export interface ListingSearchBootstrap {
  source?: PublicListingSource;
  initialListings?: Listing[];
  initialListing?: Listing;
  references?: PublicListingReferences;
  catalogLoaded?: boolean;
  initialError?: string;
}

const emptyReferences: PublicListingReferences = { services: {}, categories: {} };

function mergeListings(items: readonly Listing[], detail?: Listing): Listing[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  if (detail) byId.set(detail.id, detail);
  return [...byId.values()];
}

export function useListingSearch(options: ListingSearchBootstrap = {}) {
  const source = options.source ?? (runtimeConfig.listingDataMode === 'session-mock' ? 'session-mock' : 'http');
  const initialListings = options.initialListings ?? (source === 'session-mock' ? mockListings : []);
  const references = options.references ?? emptyReferences;
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [favorites, setFavorites] = useState<Set<number>>(new Set(source === 'session-mock' ? [1, 4, 8] : []));
  const [remoteListings, setRemoteListings] = useState<Listing[]>(initialListings);
  const [listingDetails, setListingDetails] = useState<Map<number, Listing>>(() => {
    const details = new Map<number, Listing>();
    if (options.initialListing) details.set(options.initialListing.id, options.initialListing);
    return details;
  });
  const [loading, setLoading] = useState(source === 'http' && !options.catalogLoaded);
  const [error, setError] = useState(options.initialError ?? '');
  const [retryRevision, setRetryRevision] = useState(0);
  const detailRequests = useRef(new Map<number, Promise<Listing>>());
  const lastRequestKeyRef = useRef(options.catalogLoaded ? JSON.stringify(filtersToPublicListingParams(defaultFilters, '', references)) : null);

  const requestParams = useMemo(() => filtersToPublicListingParams(filters, query, references), [filters, query, references]);
  const requestKey = useMemo(() => JSON.stringify(requestParams), [requestParams]);

  useEffect(() => {
    if (source !== 'http') return;
    if (retryRevision === 0 && lastRequestKeyRef.current === requestKey) {
      setLoading(false);
      return;
    }
    lastRequestKeyRef.current = requestKey;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void fetchPublicListings(requestParams, controller.signal)
        .then((items) => setRemoteListings(items))
        .catch((requestError: unknown) => {
          if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
          setError('Не удалось загрузить объявления. Проверьте подключение и попробуйте ещё раз.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, query.trim() ? 220 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, requestKey, requestParams, retryRevision, source]);

  const allListings = useMemo(() => {
    const merged = mergeListings(remoteListings, options.initialListing).map((item) => listingDetails.get(item.id) ?? item);
    listingDetails.forEach((detail, id) => {
      if (!merged.some((item) => item.id === id)) merged.push(detail);
    });
    return merged;
  }, [listingDetails, options.initialListing, remoteListings]);

  const getListing = useCallback((id: number) => listingDetails.get(id) ?? allListings.find((item) => item.id === id), [allListings, listingDetails]);
  const loadListing = useCallback((id: number): Promise<Listing | undefined> => {
    const existingDetail = listingDetails.get(id);
    if (existingDetail?.photos || source === 'session-mock') return Promise.resolve(existingDetail ?? allListings.find((item) => item.id === id));
    const inFlight = detailRequests.current.get(id);
    if (inFlight) return inFlight;
    const request = fetchPublicListing(id)
      .then((detail) => {
        setListingDetails((current) => new Map(current).set(id, detail));
        return detail;
      })
      .finally(() => detailRequests.current.delete(id));
    detailRequests.current.set(id, request);
    return request;
  }, [allListings, listingDetails, source]);

  const filterListings = useCallback((draft: SearchFilters) => {
    if (source === 'session-mock') return filterListingCollection(allListings, draft, query, favorites);
    const previewFilters = { ...draft, serviceIds: [], categoryId: null };
    return filterListingCollection(remoteListings, previewFilters, query, favorites, { ignoreOwnership: true });
  }, [allListings, favorites, query, remoteListings, source]);
  const visibleListings = useMemo(() => {
    if (source === 'session-mock') return filterListings(filters);
    return remoteListings.filter((item) => !filters.favoritesOnly || favorites.has(item.id));
  }, [favorites, filterListings, filters, remoteListings, source]);
  const hasSearchConstraints = countActiveFilters(filters) > 0 || query.trim().length > 0;
  const similarListings = useMemo(() => {
    if (source !== 'session-mock' || filters.favoritesOnly || visibleListings.length > 0 || !hasSearchConstraints) return [];
    const closeMatches = sortItems(allListings.filter((item) => matchesSimilar(item, filters, query)), filters.sort);
    if (closeMatches.length > 0) return closeMatches.slice(0, 12);
    return sortItems(allListings.filter((item) => filters.showOwnListings || !item.isOwn), filters.sort).slice(0, 12);
  }, [allListings, filters, hasSearchConstraints, query, source, visibleListings.length]);
  const showingSimilar = similarListings.length > 0;
  const catalogListings = showingSimilar ? similarListings : visibleListings;
  const toggleFavorite = useCallback((id: number) => setFavorites((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }), []);
  const toggleQuickRoom = useCallback((value: 'all' | RoomFilter) => setFilters((current) => value === 'all' ? { ...current, rooms: [] } : { ...current, rooms: toggleItem(current.rooms, value) }), []);
  const reset = useCallback(() => { setQuery(''); setFilters(defaultFilters); }, []);
  const retry = useCallback(() => setRetryRevision((value) => value + 1), []);

  return {
    query, setQuery, filters, setFilters, favorites, toggleFavorite, toggleQuickRoom, reset,
    visibleListings, catalogListings, showingSimilar, hasSearchConstraints, filterListings,
    allListings, getListing, loadListing, loading, error, retry,
    activeFilters: countActiveFilters(filters),
  };
}
