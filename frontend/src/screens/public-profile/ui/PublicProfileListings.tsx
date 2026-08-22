import type { CSSProperties } from 'react';
import { ListingCard, type ListingLayoutMode } from '@entities/listing';
import type { Listing } from '@shared/data/listings';
import { CatalogToolbar } from '@features/search-filters';
import { DescriptionText, EmptyState, SectionTitle } from '@ui';

interface PublicProfileListingsProps {
  ownerListings: Listing[];
  visibleListings: Listing[];
  layout: ListingLayoutMode;
  searchLabel: string;
  activeFilters: number;
  hasConstraints: boolean;
  favorites: ReadonlySet<number>;
  onOpenSearch: () => void;
  onClearSearch: () => void;
  onToggleLayout: () => void;
  onOpenFilters: () => void;
  onReset: () => void;
  onToggleFavorite: (id: number) => void;
  onOpenListing: (id: number) => void;
  onBookListing: (id: number) => void;
}

export function PublicProfileListings(props: PublicProfileListingsProps) {
  return (
    <section className="public-profile-listings">
      <div className="public-profile-section-heading">
        <SectionTitle>Объявления</SectionTitle>
        <DescriptionText>{props.hasConstraints ? `${props.visibleListings.length} из ${props.ownerListings.length}` : listingCountLabel(props.ownerListings.length)}</DescriptionText>
      </div>
      <div className="public-profile-catalog-controls">
        <CatalogToolbar searchLabel={props.searchLabel} searchPlaceholder="Поиск в профиле" layout={props.layout} activeFilters={props.activeFilters} onOpenSearch={props.onOpenSearch} onClearSearch={props.onClearSearch} onToggleLayout={props.onToggleLayout} onOpenFilters={props.onOpenFilters} />
      </div>
      <div className={`listing-feed public-profile-listing-feed ${props.layout === 'grid' ? 'grid-layout' : 'list-layout'}`}>
        {props.visibleListings.length ? props.visibleListings.map((listing, index) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            layout={props.layout}
            mode="status"
            openLabel="Подробнее"
            favorite={props.favorites.has(listing.id)}
            onToggleFavorite={() => props.onToggleFavorite(listing.id)}
            onOpen={() => props.onOpenListing(listing.id)}
            onBook={listing.isOwn ? undefined : () => props.onBookListing(listing.id)}
            style={{ '--listing-index': index } as CSSProperties}
          />
        )) : <EmptyState title="Ничего не найдено" description={props.ownerListings.length ? 'Измените запрос или сбросьте фильтры.' : 'У пользователя пока нет активных объявлений.'} actionLabel={props.ownerListings.length ? 'Сбросить фильтры' : undefined} onAction={props.ownerListings.length ? props.onReset : undefined} />}
      </div>
    </section>
  );
}

function listingCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} объявление`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} объявления`;
  return `${count} объявлений`;
}
