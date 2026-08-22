import { useEffect, useRef, useState } from 'react';
import type { Listing } from '@shared/data/listings';
import type { SearchFilters } from '@shared/types/filters';
import { DesktopTopbar } from '@widgets/app-navigation';
import { MapCanvas } from './MapCanvas';
import { MapResultsPanel } from './MapResultsPanel';
import '../map-page.css';

type MapPageProps = {
  listings: Listing[];
  filters: SearchFilters;
  query: string;
  activeFilters: number;
  favorites: Set<number>;
  initialSelectedId?: number;
  onToggleFavorite: (id: number) => void;
  onOpenListing: (id: number) => void;
  onOpenSearch: () => void;
  onClearLocation: () => void;
  onOpenFilters: () => void;
  onHome: () => void;
  onCreate: () => void;
  onMessages: () => void;
  onProfile: () => void;
};

export function MapPage({
  listings,
  filters,
  query,
  activeFilters,
  favorites,
  initialSelectedId,
  onToggleFavorite,
  onOpenListing,
  onOpenSearch,
  onClearLocation,
  onOpenFilters,
  onHome,
  onCreate,
  onMessages,
  onProfile,
}: MapPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId ?? null);
  const [cardClosing, setCardClosing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationState, setLocationState] = useState<'idle' | 'found' | 'error'>('idle');
  const closeTimerRef = useRef<number | null>(null);
  const selected = listings.find((item) => item.id === selectedId) ?? null;

  useEffect(() => () => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const selectListing = (id: number | null) => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setCardClosing(false);
    setSelectedId(id);
  };

  const closeSelectedListing = () => {
    if (cardClosing || selectedId == null) return;
    setCardClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedId(null);
      setCardClosing(false);
      closeTimerRef.current = null;
    }, 220);
  };
  const handleLocate = () => {
    if (locating) return;
    setLocating(true);
    setLocationState('idle');
    if (!navigator.geolocation) {
      setLocating(false);
      setLocationState('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => { setLocating(false); setLocationState('found'); selectListing(null); },
      () => { setLocating(false); setLocationState('error'); },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="map-page-shell">
      <DesktopTopbar
        active="map"
        onSearch={onHome}
        onMap={() => undefined}
        onMessages={onMessages}
        onProfile={onProfile}
        onCreate={onCreate}
      />

      <main className="map-workspace">
        <MapResultsPanel
          listings={listings}
          selectedId={selectedId}
          favorites={favorites}
          onSelect={selectListing}
          onOpen={onOpenListing}
          onFavorite={onToggleFavorite}
          onOpenFilters={onOpenFilters}
        />
        <MapCanvas
          listings={listings}
          filters={filters}
          query={query}
          activeFilters={activeFilters}
          favorites={favorites}
          selected={selected}
          selectedId={selectedId}
          cardClosing={cardClosing}
          locating={locating}
          locationState={locationState}
          onSelect={selectListing}
          onCloseSelected={closeSelectedListing}
          onOpenSelected={onOpenListing}
          onToggleFavorite={onToggleFavorite}
          onOpenSearch={onOpenSearch}
          onClearLocation={onClearLocation}
          onOpenFilters={onOpenFilters}
          onLocate={handleLocate}
        />
      </main>

    </div>
  );
}
