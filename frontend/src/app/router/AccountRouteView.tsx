import { demoSession } from '@features/auth';
import type { AppRouteViewProps } from './AppRouteView';
import {
  GuestMessagesPage,
  GuestProfilePage,
  MessagesPage,
  MyListingsPage,
  MyReviewsPage,
  NotificationsPage,
  ProfilePage,
  PublicProfilePage,
  PublicReviewsPage,
  RequestsPage,
  ReviewEditorPage,
} from './routeScreenLoaders';

export function AccountRouteView({
  route,
  search,
  navigate,
  back,
  openListing,
  openChat,
  openBooking,
  openRequests,
  onToast,
  onAuthRequired,
  onTabBarHiddenChange,
}: AppRouteViewProps) {
  const goHome = () => navigate({ name: 'home' });
  const goCreate = () => navigate({ name: 'create' });
  const goMap = () => navigate({ name: 'map' });
  const goMessages = () => navigate({ name: 'messages', conversationId: null });
  const goProfile = () => navigate({ name: 'profile' });

  switch (route.name) {
    case 'notifications':
      return (
        <NotificationsPage
          onBack={() => back({ name: 'profile' })}
          onHome={goHome}
          onCreate={goCreate}
          onMap={goMap}
          onMessages={goMessages}
          onProfile={goProfile}
          onOpen={(item) => {
            if (item.scope === 'messages') return item.entityId ? openChat(item.entityId) : goMessages();
            if (item.scope === 'incoming') return navigate({ name: 'requests', direction: 'incoming', requestId: item.entityId ?? null });
            if (item.scope === 'bookings') return navigate({ name: 'requests', direction: 'outgoing', requestId: item.entityId ?? null });
            if (item.scope === 'listings') return item.entityId ? openListing(item.entityId) : goHome();
            navigate({
              name: 'my-reviews',
              tab: item.action === 'received' || item.action === 'reply_published' ? 'received' : 'written',
              ...(item.entityId ? { focusReviewId: item.entityId } : {}),
            });
          }}
        />
      );

    case 'review-editor':
      return (
        <ReviewEditorPage
          requestId={route.requestId}
          onBack={() => back({ name: 'requests', direction: 'outgoing', requestId: null })}
          onDone={() => navigate({ name: 'my-reviews' }, true)}
          onHome={goHome}
          onCreate={goCreate}
          onMap={goMap}
          onMessages={goMessages}
          onProfile={goProfile}
          onToast={onToast}
        />
      );

    case 'my-reviews':
      return (
        <MyReviewsPage
          initialTab={route.tab}
          focusReviewId={route.focusReviewId}
          onBack={() => back({ name: 'profile' })}
          onHome={goHome}
          onCreate={goCreate}
          onMap={goMap}
          onMessages={goMessages}
          onProfile={goProfile}
          onEditReview={(requestId) => navigate({ name: 'review-editor', requestId })}
          onToast={onToast}
        />
      );

    case 'public-reviews':
      return (
        <PublicReviewsPage
          kind={route.kind}
          subjectId={route.subjectId}
          onBack={() => {
            if (route.kind === 'user') {
              back({ name: 'public-profile', userId: route.subjectId });
              return;
            }
            const listingId = Number(route.subjectId);
            back(Number.isSafeInteger(listingId) && listingId > 0 ? { name: 'listing', listingId } : { name: 'home' });
          }}
          onHome={goHome}
          onCreate={goCreate}
          onMap={goMap}
          onMessages={goMessages}
          onProfile={goProfile}
          onBookListing={openBooking}
          onEditListing={(id) => navigate({ name: 'create', editId: id })}
          onToast={onToast}
        />
      );

    case 'requests':
      return (
        <RequestsPage
          mode={route.direction}
          requestId={route.requestId}
          onOpenRequest={(direction, requestId) => navigate({ name: 'requests', direction, requestId })}
          onBack={() => back({ name: 'profile' })}
          onBackToList={(direction) => back({ name: 'requests', direction, requestId: null })}
          onHome={goHome}
          onCreate={goCreate}
          onMap={goMap}
          onMessages={goMessages}
          onProfile={goProfile}
          onOpenListing={openListing}
          onOpenChat={openChat}
          onOpenProfile={(userId) => navigate({ name: 'public-profile', userId })}
          onRepeatBooking={openBooking}
          onReview={(requestId) => navigate({ name: 'review-editor', requestId })}
          onToast={onToast}
        />
      );

    case 'messages':
      if (demoSession.getSnapshot().status === 'guest') {
        return <GuestMessagesPage onHome={goHome} onCreate={goCreate} onMap={goMap} onProfile={goProfile} onAuth={() => onAuthRequired({ name: 'messages', conversationId: null })} onTabBarHiddenChange={onTabBarHiddenChange} />;
      }
      return (
        <MessagesPage
          activeConversationId={route.conversationId}
          onOpenConversation={openChat}
          onBackToList={() => back({ name: 'messages', conversationId: null })}
          onHome={goHome}
          onCreate={goCreate}
          onMap={goMap}
          onProfile={goProfile}
          onOpenListing={openListing}
          onOpenProfile={(userId) => navigate({ name: 'public-profile', userId })}
          onOpenRequest={(requestId, direction) => navigate({ name: 'requests', direction, requestId })}
          onToast={onToast}
          onTabBarHiddenChange={onTabBarHiddenChange}
        />
      );

    case 'public-profile':
      return (
        <PublicProfilePage
          userId={route.userId}
          onBack={() => back({ name: 'messages', conversationId: null })}
          onHome={goHome}
          onCreate={goCreate}
          onMap={goMap}
          onMessages={goMessages}
          onProfile={goProfile}
          onOpenConversation={openChat}
          onOpenListing={openListing}
          onBookListing={openBooking}
          favorites={search.favorites}
          onToggleFavorite={search.toggleFavorite}
          onOpenReviews={(userId) => navigate({ name: 'public-reviews', kind: 'user', subjectId: userId })}
          onToast={onToast}
        />
      );

    case 'profile':
      if (demoSession.getSnapshot().status === 'guest') {
        return (
          <GuestProfilePage
            onHome={goHome}
            onCreate={goCreate}
            onMap={goMap}
            onMessages={goMessages}
            onFavorites={() => { search.setFilters((current) => ({ ...current, favoritesOnly: true })); navigate({ name: 'home' }); }}
            onTabBarHiddenChange={onTabBarHiddenChange}
            onAuth={(target) => {
              if (target === 'my-listings') return onAuthRequired({ name: 'my-listings' });
              if (target === 'my-reviews') return onAuthRequired({ name: 'my-reviews' });
              onAuthRequired({ name: 'profile' });
            }}
          />
        );
      }
      return (
        <ProfilePage
          onHome={goHome}
          onCreate={goCreate}
          onMap={goMap}
          onMessages={goMessages}
          onBookings={() => openRequests('outgoing')}
          onFavorites={() => { search.setFilters((current) => ({ ...current, favoritesOnly: true })); navigate({ name: 'home' }); }}
          onIncoming={() => openRequests('incoming')}
          onMyListings={() => navigate({ name: 'my-listings' })}
          onReviews={() => navigate({ name: 'my-reviews' })}
          onNotifications={() => navigate({ name: 'notifications' })}
          onSignOut={() => { demoSession.signOut(); navigate({ name: 'welcome' }, true); }}
          onToast={onToast}
          onTabBarHiddenChange={onTabBarHiddenChange}
        />
      );

    case 'my-listings':
      return <MyListingsPage
        initialTab={route.tab}
        favoriteIds={search.favorites}
        onBack={() => back({ name: 'profile' })}
        onCreate={goCreate}
        onOpenListing={openListing}
        onEdit={(id) => navigate({ name: 'create', editId: id })}
        onPromote={(id) => navigate({ name: 'promotion', listingId: id })}
        onHome={goHome}
        onMap={goMap}
        onMessages={goMessages}
        onProfile={goProfile}
        onToast={onToast}
      />;

    default:
      return null;
  }
}
