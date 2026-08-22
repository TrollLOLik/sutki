import type { Dispatch, SetStateAction } from 'react';
import type { useListingSearch } from '@features/listing-search';
import type { RequestDirection } from '@features/requests';
import { demoSession } from '@features/auth';
import { myListingsRepository, useMyListingsSnapshot } from '@features/my-listings';
import { HomePage, type HomeTab } from '@pages/home';
import type { BookingDraft } from '@pages/listing-detail';
import type { AppSearchLayer } from '../ui/AppSearchLayers';
import { RouteErrorPage } from '../ui/RouteErrorPage';
import { AccountRouteView } from './AccountRouteView';
import { appRoutePath, type AppRoute } from './appRoute';
import { AuthRouteView } from './AuthRouteView';
import {
  BookingPage,
  CreateListingPage,
  ListingDetailPage,
  MapPage,
  PromotionPage,
  RouteScreenBoundary,
  UiKitPage,
} from './routeScreenLoaders';

type ListingSearchController = ReturnType<typeof useListingSearch>;

export interface AppRouteViewProps {
  route: AppRoute;
  search: ListingSearchController;
  bookingDraft?: BookingDraft;
  initialScrollTop: number;
  catalogAlreadyShown: boolean;
  setLayer: Dispatch<SetStateAction<AppSearchLayer>>;
  navigate: (route: AppRoute, replace?: boolean) => void;
  back: (fallback?: AppRoute) => void;
  openListing: (listingId: number) => void;
  openChat: (conversationId: number) => void;
  openBooking: (listingId: number, draft?: BookingDraft) => void;
  openRequests: (direction: RequestDirection) => void;
  onHomeNavigation: (target: HomeTab | 'create') => void;
  onToast: (message: string) => void;
  onAuthComplete: () => void;
  onAuthCancelled: () => void;
  onAuthRequired: (target: AppRoute) => void;
  onBookingAuthRequired: (listingId: number, draft: BookingDraft) => void;
  onTabBarHiddenChange: (hidden: boolean) => void;
}

export function AppRouteView(props: AppRouteViewProps) {
  return (
    <RouteScreenBoundary
      routeKey={appRoutePath(props.route)}
      onBack={() => props.back({ name: 'home' })}
      onHome={() => props.navigate({ name: 'home' }, true)}
    >
      <AppRouteContent {...props} />
    </RouteScreenBoundary>
  );
}

function AppRouteContent(props: AppRouteViewProps) {
  switch (props.route.name) {
    case 'welcome':
    case 'auth-phone':
    case 'auth-email':
    case 'auth-code':
    case 'profile-setup':
      return <AuthRouteView {...props} />;

    case 'notifications':
    case 'review-editor':
    case 'my-reviews':
    case 'public-reviews':
    case 'requests':
    case 'messages':
    case 'public-profile':
    case 'profile':
    case 'my-listings':
      return <AccountRouteView {...props} />;

    default:
      return <MarketplaceRouteView {...props} />;
  }
}

function MarketplaceRouteView({
  route,
  search,
  bookingDraft,
  initialScrollTop,
  catalogAlreadyShown,
  setLayer,
  navigate,
  back,
  openListing,
  openBooking,
  openRequests,
  onHomeNavigation,
  onToast,
  onAuthRequired,
  onBookingAuthRequired,
  onTabBarHiddenChange,
}: AppRouteViewProps) {
  const ownerListings = useMyListingsSnapshot();
  const ownerEntryById = new Map(ownerListings.map((item) => [item.listing.id, item]));
  const ownerById = new Map(ownerListings.map((item) => [item.listing.id, item.listing]));
  const catalogListings = search.catalogListings.map((item) => ownerById.get(item.id) ?? item);
  const goHome = () => navigate({ name: 'home' });
  const goCreate = () => navigate({ name: 'create' });
  const goMap = () => navigate({ name: 'map' });
  const goMessages = () => navigate({ name: 'messages', conversationId: null });
  const goProfile = () => navigate({ name: 'profile' });

  switch (route.name) {
    case 'map':
      return (
        <MapPage
          listings={catalogListings}
          initialSelectedId={route.listingId}
          filters={search.filters}
          query={search.query}
          activeFilters={search.activeFilters}
          favorites={search.favorites}
          onToggleFavorite={search.toggleFavorite}
          onOpenListing={openListing}
          onOpenSearch={() => setLayer('search')}
          onClearLocation={() => { search.setQuery(''); search.setFilters((current) => ({ ...current, city: null })); }}
          onOpenFilters={() => setLayer('filters')}
          onHome={goHome}
          onCreate={goCreate}
          onMessages={goMessages}
          onProfile={goProfile}
        />
      );

    case 'ui-kit':
      return <UiKitPage onBack={() => back({ name: 'home' })} />;

    case 'create':
      return <CreateListingPage key={route.editId ? `edit-${route.editId}` : 'new'} editId={route.editId} onClose={() => back(route.editId ? { name: 'my-listings' } : { name: 'home' })} onOpenMyListings={() => navigate({ name: 'my-listings' }, true)} onPromote={(listingId) => navigate({ name: 'promotion', listingId })} onPublished={onToast} onHome={goHome} onMap={goMap} onMessages={goMessages} onProfile={goProfile} onCreate={goCreate} />;

    case 'promotion':
      return <PromotionPage listingId={route.listingId} onBack={() => back({ name: 'my-listings' })} onOpenListing={openListing} onCheckout={() => {}} onHome={goHome} onMap={goMap} onMessages={goMessages} onProfile={goProfile} onCreate={goCreate} />;

    case 'booking': {
      const listing = ownerById.get(route.listingId) ?? search.getListing(route.listingId);
      if (!listing) return <RouteErrorPage title="Объявление не найдено" description="Возможно, оно удалено или ссылка устарела." onBack={() => back({ name: 'home' })} onHome={goHome} />;
      return (
        <BookingPage
          listing={listing}
          onBack={() => back({ name: 'listing', listingId: listing.id })}
          onHome={goHome}
          onMap={goMap}
          onMessages={goMessages}
          onProfile={goProfile}
          onCreate={goCreate}
          onOpenBookings={() => openRequests('outgoing')}
          initialCheckIn={bookingDraft?.checkIn}
          initialCheckOut={bookingDraft?.checkOut}
          initialGuests={bookingDraft?.guests}
          initialName={bookingDraft?.name}
          initialPhone={bookingDraft?.phone}
          initialMessage={bookingDraft?.message}
          initialSubmitAfterAuth={bookingDraft?.submitAfterAuth}
          isGuest={demoSession.getSnapshot().status === 'guest'}
          onRequireAuth={(draft) => onBookingAuthRequired(listing.id, draft)}
        />
      );
    }

    case 'listing': {
      const ownerEntry = ownerEntryById.get(route.listingId);
      const listing = ownerEntry?.listing ?? search.getListing(route.listingId);
      if (!listing) return <RouteErrorPage title="Объявление не найдено" description="Возможно, оно удалено или ссылка устарела." onBack={() => back({ name: 'home' })} onHome={goHome} />;
      return (
        <ListingDetailPage
          listing={listing}
          allListings={search.allListings}
          favorite={search.favorites.has(listing.id)}
          favorites={search.favorites}
          onToggleFavorite={() => search.toggleFavorite(listing.id)}
          onToggleListingFavorite={(listingId) => search.toggleFavorite(listingId)}
          onBack={() => back({ name: 'home' })}
          onHome={goHome}
          onMap={() => navigate({ name: 'map', listingId: listing.id })}
          onMessages={goMessages}
          onProfile={goProfile}
          onCreate={goCreate}
          onOpenListing={openListing}
          onOpenOwner={(userId) => navigate({ name: 'public-profile', userId })}
          onOpenReviews={(listingId) => navigate({ name: 'public-reviews', kind: 'listing', subjectId: String(listingId) })}
          onEdit={() => navigate({ name: 'create', editId: listing.id })}
          onPromote={() => navigate({ name: 'promotion', listingId: listing.id })}
          onUnpublish={ownerEntry?.status === 'active' ? () => { myListingsRepository.setPublication(listing.id, false); onToast('Объявление снято с публикации'); } : undefined}
          onPublish={ownerEntry?.status === 'unpublished' ? () => { myListingsRepository.setPublication(listing.id, true); onToast('Объявление отправлено на проверку'); } : undefined}
          ownerStatus={ownerEntry?.status}
          ownerRejectionReason={ownerEntry?.rejectionReason}
          onBook={(draft) => openBooking(listing.id, draft)}
          onToast={onToast}
        />
      );
    }

    case 'home':
    default:
      return (
        <HomePage
          initialScrollTop={initialScrollTop}
          skipInitialLoading={catalogAlreadyShown}
          onTabBarHiddenChange={onTabBarHiddenChange}
          query={search.query}
          filters={search.filters}
          listings={catalogListings}
          loading={search.loading}
          error={search.error}
          onRetry={search.retry}
          favorites={search.favorites}
          activeFilters={search.activeFilters}
          showingSimilar={search.showingSimilar}
          hasSearchConstraints={search.hasSearchConstraints}
          onClearQuery={() => { search.setQuery(''); search.setFilters((current) => ({ ...current, city: null })); }}
          onOpenSearch={() => setLayer('search')}
          onOpenDate={() => setLayer('date')}
          onOpenGuests={() => setLayer('guests')}
          onOpenFilters={() => setLayer('filters')}
          onToggleQuickRoom={search.toggleQuickRoom}
          onToggleFavorite={search.toggleFavorite}
          onToggleFavoritesOnly={() => search.setFilters((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }))}
          onOpenListing={openListing}
          onBookListing={(listingId) => openBooking(listingId)}
          onEditListing={(id) => navigate({ name: 'create', editId: id })}
          onPromoteListing={(id) => navigate({ name: 'promotion', listingId: id })}
          onReset={search.reset}
          onNavigate={onHomeNavigation}
          guest={demoSession.getSnapshot().status === 'guest'}
          onAuth={() => onAuthRequired({ name: 'home' })}
        />
      );
  }
}
