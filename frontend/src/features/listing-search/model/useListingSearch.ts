import { useCallback, useMemo, useState } from 'react';
import { listings, type Listing } from '@shared/data/listings';
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
  return sortItems(
    source.filter((item) => matches(item, filters, query, favorites, options.ignoreOwnership)),
    filters.sort,
  );
}

export function useListingSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [favorites, setFavorites] = useState<Set<number>>(new Set([1, 4, 8]));
  const filterListings = useCallback((draft: SearchFilters) => filterListingCollection(listings, draft, query, favorites), [favorites, query]);
  const visibleListings = useMemo(() => filterListings(filters), [filterListings, filters]);
  const hasSearchConstraints = countActiveFilters(filters) > 0 || query.trim().length > 0;
  const similarListings = useMemo(() => {
    if (filters.favoritesOnly || visibleListings.length > 0 || !hasSearchConstraints) return [];
    const closeMatches = sortItems(listings.filter((item) => matchesSimilar(item, filters, query)), filters.sort);
    if (closeMatches.length > 0) return closeMatches.slice(0, 12);
    return sortItems(listings.filter((item) => filters.showOwnListings || !item.isOwn), filters.sort).slice(0, 12);
  }, [filters, hasSearchConstraints, query, visibleListings.length]);
  const showingSimilar = similarListings.length > 0;
  const catalogListings = showingSimilar ? similarListings : visibleListings;
  const toggleFavorite = useCallback((id: number) => setFavorites((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }), []);
  const toggleQuickRoom = useCallback((value: 'all' | RoomFilter) => setFilters((current) => value === 'all' ? { ...current, rooms: [] } : { ...current, rooms: toggleItem(current.rooms, value) }), []);
  const reset = useCallback(() => { setQuery(''); setFilters(defaultFilters); }, []);
  return { query, setQuery, filters, setFilters, favorites, toggleFavorite, toggleQuickRoom, reset, visibleListings, catalogListings, showingSimilar, hasSearchConstraints, filterListings, activeFilters: countActiveFilters(filters) };
}
