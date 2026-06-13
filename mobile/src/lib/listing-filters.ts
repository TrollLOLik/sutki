import type { RoomFilter, SearchFilters } from '@/store/filters';
import type { ListingCard } from '@/types/listing';

function matchesRoom(rooms: string, filter: RoomFilter): boolean {
  const n = Number(rooms);
  switch (filter) {
    case 'studio':
      return !Number.isFinite(n) || n <= 0;
    case '1':
      return n === 1;
    case '2':
      return n === 2;
    case '3plus':
      return n >= 3;
    default:
      return false;
  }
}

/**
 * Client-side filtering over the listings feed. Only the fields exposed on the
 * card DTO can be filtered here (text, price, rooms). Amenities, dates and
 * guests are part of the filters UI but require server-side support (backend
 * B2) and are intentionally not applied yet.
 */
export function filterListings(
  items: ListingCard[],
  filters: SearchFilters,
  query: string,
): ListingCard[] {
  const q = query.trim().toLowerCase();

  return items.filter((item) => {
    if (q) {
      const haystack = `${item.address} ${item.description} ${item.city}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.priceMin != null && item.price < filters.priceMin) return false;
    if (filters.priceMax != null && item.price > filters.priceMax) return false;

    if (filters.rooms.length > 0 && !filters.rooms.some((r) => matchesRoom(item.rooms, r))) {
      return false;
    }

    return true;
  });
}
