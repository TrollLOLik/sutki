import { RefreshCw } from 'lucide-react';
import { type CSSProperties } from 'react';
import { type ListingLayoutMode } from '@entities/listing';
import { CatalogFilterShortcuts, CatalogToolbar } from '@features/search-filters';
import { DesktopTopbar } from '@widgets/app-navigation';
import type { Listing } from '@shared/data/listings';
import { type RoomFilter, type SearchFilters } from '@shared/types/filters';
import { useCatalogPageController } from '../model/useCatalogPageController';
import { CatalogFeed } from './CatalogFeed';

export type HomeTab = 'search' | 'map' | 'messages' | 'profile';

interface HomePageProps {
  query: string;
  filters: SearchFilters;
  listings: Listing[];
  favorites: Set<number>;
  activeFilters: number;
  loading?: boolean;
  showingSimilar?: boolean;
  hasSearchConstraints?: boolean;
  initialLayout?: ListingLayoutMode;
  initialScrollTop?: number;
  skipInitialLoading?: boolean;
  onTabBarHiddenChange?: (hidden: boolean) => void;
  onClearQuery: () => void;
  onOpenSearch: () => void;
  onOpenDate: () => void;
  onOpenGuests: () => void;
  onOpenFilters: () => void;
  onToggleQuickRoom: (value: 'all' | RoomFilter) => void;
  onToggleFavorite: (id: number) => void;
  onToggleFavoritesOnly: () => void;
  onOpenListing: (id: number) => void;
  onBookListing: (id: number) => void;
  onEditListing: (id: number) => void;
  onPromoteListing: (id: number) => void;
  onReset: () => void;
  onNavigate: (tab: HomeTab | 'create') => void;
  guest?: boolean;
  onAuth?: () => void;
}

export function HomePage(props: HomePageProps) {
  const searchLabel = props.filters.city ?? props.query;
  const { layout, toggleLayout, simulatedLoading, headerCollapsed, pullDistance, refreshing } = useCatalogPageController({
    initialLayout: props.initialLayout,
    initialScrollTop: props.initialScrollTop,
    skipInitialLoading: props.skipInitialLoading,
    onTabBarHiddenChange: props.onTabBarHiddenChange,
  });
  const loading = props.loading ?? simulatedLoading;

  return (
    <div className="app-shell catalog-shell">
      <div
        className={`catalog-refresh-indicator ${pullDistance > 0 || refreshing ? 'is-visible' : ''} ${refreshing ? 'refreshing' : ''} ${pullDistance >= 72 ? 'armed' : ''}`}
        style={{ '--pull-distance': `${pullDistance}px`, '--pull-opacity': Math.min(1, pullDistance / 36), opacity: refreshing ? 1 : Math.min(1, pullDistance / 36) } as CSSProperties}
        role="status"
        aria-live="polite"
        aria-hidden={pullDistance === 0 && !refreshing}
        aria-label={refreshing ? 'Обновление каталога' : 'Потяните вниз для обновления'}
      ><RefreshCw size={19} /></div>
      <DesktopTopbar
        active="search"
        onSearch={() => props.onNavigate('search')}
        onMap={() => props.onNavigate('map')}
        onMessages={() => props.onNavigate('messages')}
        onProfile={() => props.onNavigate('profile')}
        onCreate={() => props.onNavigate('create')}
      />

      <header className={`home-header ${headerCollapsed ? 'collapsed' : ''}`}>
        <div className="header-backdrop" />
        <div className="header-inner">
          <CatalogToolbar searchLabel={searchLabel} layout={layout} activeFilters={props.activeFilters} onOpenSearch={props.onOpenSearch} onClearSearch={props.onClearQuery} onToggleLayout={toggleLayout} onOpenFilters={props.onOpenFilters} />
          <CatalogFilterShortcuts filters={props.filters} onToggleQuickRoom={props.onToggleQuickRoom} onOpenDate={props.onOpenDate} onOpenGuests={props.onOpenGuests} onToggleFavoritesOnly={props.onToggleFavoritesOnly} />
        </div>
      </header>

      <CatalogFeed
        layout={layout}
        headerCollapsed={headerCollapsed}
        loading={loading}
        showingSimilar={props.showingSimilar}
        guest={props.guest}
        favoritesOnly={props.filters.favoritesOnly}
        listings={props.listings}
        favorites={props.favorites}
        onAuth={props.onAuth}
        onToggleFavorite={props.onToggleFavorite}
        onOpenListing={props.onOpenListing}
        onBookListing={props.onBookListing}
        onEditListing={props.onEditListing}
        onPromoteListing={props.onPromoteListing}
      />

    </div>
  );
}
