import { AlertCircle, CloudUpload, Search, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Listing } from '@shared/data/listings';
import { ListingCard, type ListingLayoutMode } from '@entities/listing';
import { Button, CompactAlert, EmptyState, ListCell, Skeleton } from '@ui';

interface CatalogFeedProps {
  layout: ListingLayoutMode;
  headerCollapsed: boolean;
  loading: boolean;
  error?: string;
  showingSimilar?: boolean;
  guest?: boolean;
  favoritesOnly?: boolean;
  listings: Listing[];
  favorites: ReadonlySet<number>;
  onAuth?: () => void;
  onRetry?: () => void;
  onToggleFavorite: (listingId: number) => void;
  onOpenListing: (listingId: number) => void;
  onBookListing: (listingId: number) => void;
  onEditListing: (listingId: number) => void;
  onPromoteListing: (listingId: number) => void;
}

export function CatalogFeed({ layout, headerCollapsed, loading, error, showingSimilar, guest, favoritesOnly, listings, favorites, onAuth, onRetry, onToggleFavorite, onOpenListing, onBookListing, onEditListing, onPromoteListing }: CatalogFeedProps) {
  return (
    <main className={`listing-feed ${layout === 'grid' ? 'grid-layout' : 'list-layout'} ${headerCollapsed ? 'header-is-collapsed' : ''}`}>
      {guest && favoritesOnly ? <ListCell className="guest-favorites-sync" before={<CloudUpload size={20} />} title="Синхронизируйте избранное" subtitle="Войдите в аккаунт, чтобы сохранить избранное в облаке и видеть его на других устройствах." multiline onClick={onAuth} /> : null}
      {!loading && error ? <CompactAlert tone="danger" icon={<AlertCircle size={20} />} title="Не удалось загрузить объявления" meta={onRetry ? <Button size="sm" mode="outline" tone="neutral" onClick={onRetry}>Повторить</Button> : undefined}>{error}</CompactAlert> : null}
      {!loading && showingSimilar ? <CompactAlert className="similar-listings-notice" tone="info" icon={<Sparkles size={20} />} title="Похожие варианты" descriptionColor="secondary">Точных совпадений нет. Некоторые параметры в этих объявлениях отличаются.</CompactAlert> : null}
      {loading ? <SkeletonFeed layout={layout} /> : listings.length ? listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} layout={layout} mode="status" favorite={favorites.has(listing.id)} onToggleFavorite={() => onToggleFavorite(listing.id)} onOpen={() => onOpenListing(listing.id)} onBook={listing.isOwn ? undefined : () => onBookListing(listing.id)} onEdit={listing.isOwn ? () => onEditListing(listing.id) : undefined} onPromote={listing.isOwn ? () => onPromoteListing(listing.id) : undefined} style={{ '--listing-index': index } as CSSProperties} />) : !error ? <EmptyState icon={<Search size={34} />} title="Ничего не найдено" description="Измените запрос или сбросьте фильтры." /> : null}
    </main>
  );
}

function SkeletonFeed({ layout }: { layout: ListingLayoutMode }) {
  return <>{[0, 1, 2, 3].map((item) => <div key={item} className={`listing-skeleton ${layout}`}><Skeleton /><div><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div></div>)}</>;
}
