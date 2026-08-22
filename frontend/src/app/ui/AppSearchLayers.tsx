import { DateSheet, FilterSheet, GuestSheet, SearchOverlay } from '@features/search-filters';
import type { useListingSearch } from '@features/listing-search';

export type AppSearchLayer = null | 'search' | 'date' | 'guests' | 'filters';

type ListingSearchController = ReturnType<typeof useListingSearch>;

export interface AppSearchLayersProps {
  layer: AppSearchLayer;
  search: ListingSearchController;
  onClose: () => void;
}

export function AppSearchLayers({ layer, search, onClose }: AppSearchLayersProps) {
  return (
    <>
      <SearchOverlay
        open={layer === 'search'}
        initialValue={search.filters.city ?? search.query}
        onClose={onClose}
        onSelect={(value) => {
          search.setQuery('');
          search.setFilters((current) => ({ ...current, city: value }));
          onClose();
        }}
        onSubmit={(value) => {
          search.setQuery(value);
          search.setFilters((current) => ({ ...current, city: null }));
          onClose();
        }}
      />

      <DateSheet
          open={layer === 'date'}
          checkIn={search.filters.checkIn}
          checkOut={search.filters.checkOut}
          onClose={onClose}
          onApply={(checkIn, checkOut) => {
            search.setFilters((current) => ({ ...current, checkIn, checkOut }));
            onClose();
          }}
        />

      <GuestSheet
          open={layer === 'guests'}
          value={search.filters.guests}
          onClose={onClose}
          onApply={(guests) => {
            search.setFilters((current) => ({ ...current, guests }));
            onClose();
          }}
        />

      <FilterSheet
          open={layer === 'filters'}
          value={search.filters}
          resultCount={(draft) => search.filterListings(draft).length}
          onClose={onClose}
          onApply={(next) => {
            search.setFilters(next);
            onClose();
          }}
        />
    </>
  );
}
