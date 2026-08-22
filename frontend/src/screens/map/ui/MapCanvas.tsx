import { Eye, Heart, Home, LocateFixed, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import type { Listing } from '@shared/data/listings';
import type { SearchFilters } from '@shared/types/filters';
import { BadgeText, BodyText, CompactAlert, DescriptionText, Pressable } from '@ui';
import { MapSelectedCard } from './MapCards';

const markerPositions = [
  [30, 27], [56, 22], [71, 38], [42, 47], [23, 57],
  [62, 64], [79, 72], [37, 78], [15, 37], [88, 48],
] as const;

function markerState(listing: Listing, favorite: boolean, active: boolean) {
  return [
    active ? 'active' : '',
    listing.isOwn ? 'own' : '',
    listing.viewed && !listing.isOwn ? 'viewed' : '',
    favorite ? 'favorite' : '',
    listing.promoted ? 'promoted' : '',
    listing.promoted === 'highlight' ? 'highlighted' : '',
  ].filter(Boolean).join(' ');
}

function MarkerIcon({ listing, favorite }: { listing: Listing; favorite: boolean }) {
  if (listing.promoted === 'highlight') return <Sparkles size={12} />;
  if (favorite) return <Heart size={12} fill="currentColor" />;
  if (listing.isOwn) return <Home size={12} />;
  if (listing.viewed) return <Eye size={12} />;
  return null;
}

interface MapCanvasProps {
  listings: Listing[];
  filters: SearchFilters;
  query: string;
  activeFilters: number;
  favorites: ReadonlySet<number>;
  selected: Listing | null;
  selectedId: number | null;
  cardClosing: boolean;
  locating: boolean;
  locationState: 'idle' | 'found' | 'error';
  onSelect: (listingId: number) => void;
  onCloseSelected: () => void;
  onOpenSelected: (listingId: number) => void;
  onToggleFavorite: (listingId: number) => void;
  onOpenSearch: () => void;
  onClearLocation: () => void;
  onOpenFilters: () => void;
  onLocate: () => void;
}

export function MapCanvas({ listings, filters, query, activeFilters, favorites, selected, selectedId, cardClosing, locating, locationState, onSelect, onCloseSelected, onOpenSelected, onToggleFavorite, onOpenSearch, onClearLocation, onOpenFilters, onLocate }: MapCanvasProps) {
  const mapItems = listings.slice(0, markerPositions.length);
  const searchLabel = (filters.city ?? query) || 'Город или адрес';

  return (
    <section className="fake-map" aria-label="Карта объявлений">
      <div className={'fake-map-canvas ' + (locating ? 'is-locating' : '')}>
        <div className="map-water water-a" />
        <div className="map-water water-b" />
        <div className="map-green green-a" />
        <div className="map-green green-b" />
        <div className="map-green green-c" />
        <span className="map-road-line road-main" />
        <span className="map-road-line road-second" />
        <span className="map-road-line road-third" />
        <span className="map-road-line road-fourth" />
        {Array.from({ length: 32 }, (_, index) => {
          const column = index % 8;
          const row = Math.floor(index / 8);
          return <i key={index} className={'map-building building-' + (column + 1)} style={{ width: 32 + (index % 4) * 11 + 'px', height: 22 + (index % 3) * 9 + 'px', left: 13 + column * 10.2 + '%', top: 9 + row * 20 + '%', transform: 'rotate(' + (-10 + (index % 5) * 5) + 'deg)' }} />;
        })}
        {mapItems.map((listing, index) => {
          const [left, top] = markerPositions[index];
          const favorite = favorites.has(listing.id);
          return (
            <Pressable key={listing.id} className={'map-price-marker ' + markerState(listing, favorite, listing.id === selectedId)} style={{ left: left + '%', top: top + '%' }} aria-label={listing.price.toLocaleString('ru-RU') + ' ₽, ' + listing.title} onClick={() => onSelect(listing.id)}>
              <MarkerIcon listing={listing} favorite={favorite} />
              <BadgeText className="ui-text--inherit-metrics" color="inherit">{listing.price.toLocaleString('ru-RU')} ₽</BadgeText>
            </Pressable>
          );
        })}
        {locationState === 'found' ? <span className="map-user-location" role="img" aria-label="Ваше местоположение"><i /></span> : null}
      </div>

      <div className="map-app-top">
        <div className="map-app-search-row">
          <div className="map-app-search">
            <Pressable className="map-app-search-main" onClick={onOpenSearch}><Search size={20} /><BodyText className={`${filters.city || query ? 'active ' : ''}ui-text--inherit-metrics`} color="inherit" truncate>{searchLabel}</BodyText></Pressable>
            {filters.city || query ? <Pressable className="map-app-search-clear" aria-label="Очистить поиск" onClick={onClearLocation}><X size={16} /></Pressable> : null}
          </div>
          <Pressable className="map-app-filter" aria-label="Фильтры" onClick={onOpenFilters}><SlidersHorizontal size={22} />{activeFilters > 0 ? <BadgeText as="i" className="map-app-filter-count ui-text--inherit-metrics" color="inherit">{activeFilters}</BadgeText> : null}</Pressable>
        </div>
      </div>

      <Pressable className={'map-locate-button ' + (locating ? 'is-loading' : '')} aria-label="Моё местоположение" onClick={onLocate}><LocateFixed size={23} /></Pressable>
      {locationState === 'error' ? <div className="map-location-status" role="status"><DescriptionText className="ui-text--inherit-metrics" color="inherit">Не удалось определить местоположение. Проверьте доступ к геопозиции.</DescriptionText></div> : null}
      {!listings.length ? <CompactAlert className="map-warning" tone="warning" icon={<Search size={16} />}>Ничего не найдено — измените запрос или фильтры.</CompactAlert> : null}
      {selected ? <MapSelectedCard listing={selected} favorite={favorites.has(selected.id)} closing={cardClosing} onOpen={() => onOpenSelected(selected.id)} onFavorite={() => onToggleFavorite(selected.id)} onClose={onCloseSelected} /> : null}
    </section>
  );
}
