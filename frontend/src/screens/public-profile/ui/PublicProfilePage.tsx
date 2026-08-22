import { Share2, UserX } from 'lucide-react';
import { DesktopTopbar } from '@widgets/app-navigation';
import { EmptyState, IconButton, ListPageHeader } from '@ui';
import { usePublicProfileController } from '../model/usePublicProfileController';
import { PublicProfileListings } from './PublicProfileListings';
import { PublicProfileOverlays } from './PublicProfileOverlays';
import { PublicProfileOverview, PublicProfileStickyActions } from './PublicProfileOverview';
import '../public-profile.css';

export interface PublicProfilePageProps {
  userId: string;
  onBack: () => void;
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onOpenConversation: (conversationId: number) => void;
  onOpenListing: (listingId: number) => void;
  onBookListing: (listingId: number) => void;
  favorites: Set<number>;
  onToggleFavorite: (listingId: number) => void;
  onOpenReviews: (userId: string) => void;
  onToast: (message: string) => void;
}

export function PublicProfilePage(props: PublicProfilePageProps) {
  const controller = usePublicProfileController({ userId: props.userId, favorites: props.favorites, onToast: props.onToast });
  const user = controller.user;
  const openConversation = () => { if (controller.conversation) props.onOpenConversation(controller.conversation.id); };
  const mobileShareAction = user ? <IconButton label="Поделиться профилем" mode="soft" tone="neutral" icon={<Share2 size={20} />} onClick={() => void controller.shareProfile()} /> : undefined;
  const desktopShareAction = user ? <IconButton label="Поделиться профилем" size="sm" mode="soft" tone="neutral" icon={<Share2 />} onClick={() => void controller.shareProfile()} /> : undefined;

  return (
    <div className="public-profile-page">
      <DesktopTopbar onSearch={props.onHome} onMap={props.onMap} onMessages={props.onMessages} onProfile={props.onProfile} onCreate={props.onCreate} />
      <ListPageHeader presentation="mobile" className="public-profile-mobile-header" title="Профиль" onBack={props.onBack} actions={mobileShareAction} />

      <main className="public-profile-main">
        <ListPageHeader presentation="desktop" title="Профиль" onBack={props.onBack} actions={desktopShareAction} />
        {user ? (
          <>
            <PublicProfileOverview user={user} conversation={controller.conversation} listingsCount={controller.ownerListings.length} actionsRef={controller.actionsRef} onOpenAvatar={() => controller.setAvatarOpen(true)} onOpenReviews={() => props.onOpenReviews(user.id)} onOpenConversation={openConversation}>
              <PublicProfileListings
                ownerListings={controller.ownerListings}
                visibleListings={controller.visibleOwnerListings}
                layout={controller.catalogLayout}
                searchLabel={controller.searchLabel}
                activeFilters={controller.activeFilters}
                hasConstraints={controller.hasCatalogConstraints}
                favorites={props.favorites}
                onOpenSearch={() => controller.setCatalogLayer('search')}
                onClearSearch={() => { controller.setCatalogQuery(''); controller.setCatalogFilters((current) => ({ ...current, city: null })); }}
                onToggleLayout={controller.toggleCatalogLayout}
                onOpenFilters={() => controller.setCatalogLayer('filters')}
                onReset={controller.resetCatalog}
                onToggleFavorite={props.onToggleFavorite}
                onOpenListing={props.onOpenListing}
                onBookListing={props.onBookListing}
              />
            </PublicProfileOverview>
          </>
        ) : (
          <EmptyState className="public-profile-not-found" icon={<UserX size={30} />} title="Профиль удалён" description="Связаться с пользователем и открыть его объявления больше нельзя." actionLabel="Вернуться назад" onAction={props.onBack} />
        )}
      </main>

      {user ? <PublicProfileStickyActions user={user} conversation={controller.conversation} visible={controller.stickyActionsVisible} onOpenConversation={openConversation} /> : null}
      <PublicProfileOverlays
        user={user}
        avatarOpen={controller.avatarOpen}
        catalogLayer={controller.catalogLayer}
        searchLabel={controller.searchLabel}
        filters={controller.catalogFilters}
        countListings={controller.countOwnerListings}
        onCloseAvatar={() => controller.setAvatarOpen(false)}
        onCloseCatalogLayer={() => controller.setCatalogLayer(null)}
        onSearchSelect={(value) => { controller.setCatalogQuery(''); controller.setCatalogFilters((current) => ({ ...current, city: value })); controller.setCatalogLayer(null); }}
        onSearchSubmit={(value) => { controller.setCatalogQuery(value); controller.setCatalogFilters((current) => ({ ...current, city: null })); controller.setCatalogLayer(null); }}
        onApplyFilters={(next) => { controller.setCatalogFilters(next); controller.setCatalogLayer(null); }}
      />
    </div>
  );
}
