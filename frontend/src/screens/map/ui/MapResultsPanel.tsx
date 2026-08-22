import { Map as MapIcon, Search } from 'lucide-react';
import type { Listing } from '@shared/data/listings';
import { Badge, DescriptionText, EmptyState } from '@ui';
import { MapResultCard } from './MapCards';

interface MapResultsPanelProps {
  listings: Listing[];
  selectedId: number | null;
  favorites: ReadonlySet<number>;
  onSelect: (listingId: number) => void;
  onOpen: (listingId: number) => void;
  onFavorite: (listingId: number) => void;
  onOpenFilters: () => void;
}

export function MapResultsPanel({ listings, selectedId, favorites, onSelect, onOpen, onFavorite, onOpenFilters }: MapResultsPanelProps) {
  return (
    <aside className="map-results-panel">
      <div className="map-results-head">
        <DescriptionText className="map-results-kicker ui-text--inherit-metrics" color="secondary">Найдено рядом</DescriptionText>
      </div>
      <div className="map-results-scroll" data-lenis-prevent>
        <Badge className="map-results-count-badge" tone="neutral" before={<MapIcon size={12} />}>Найдено: {listings.length}</Badge>
        {listings.length ? listings.map((listing) => (
          <MapResultCard key={listing.id} listing={listing} selected={listing.id === selectedId} favorite={favorites.has(listing.id)} onSelect={() => onSelect(listing.id)} onOpen={() => onOpen(listing.id)} onFavorite={() => onFavorite(listing.id)} />
        )) : (
          <EmptyState className="map-empty-results" icon={<Search size={28} />} title="Ничего не найдено" description="Измените запрос или сбросьте фильтры." actionLabel="Изменить фильтры" onAction={onOpenFilters} />
        )}
      </div>
    </aside>
  );
}
