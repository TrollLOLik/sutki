import { ArrowLeft, Heart, Share2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Listing } from '@shared/data/listings';
import { ListingPublicationConfirm, type OwnerListingStatus } from '@features/my-listings';
import { Pressable, SectionTitle } from '@shared/ui';
import { DesktopTopbar } from '@widgets/app-navigation';
import type { BookingDraft } from '../model/listingDetailTypes';
import { getListingDetailTitle } from '../model/listingDetailView';
import { useListingDetailController } from '../model/useListingDetailController';
import { ListingDesktopBookingCard, ListingMobileBookingBar } from './ListingBookingPanels';
import { ListingDetailContent } from './ListingDetailContent';
import { ListingDetailOverlays } from './ListingDetailOverlays';
import { ListingGallery } from './ListingGallery';

type DetailProps = {
  listing: Listing;
  allListings: readonly Listing[];
  favorite: boolean;
  favorites: ReadonlySet<number>;
  onToggleFavorite: () => void;
  onToggleListingFavorite: (id: number) => void;
  onBack: () => void;
  onHome: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onCreate: () => void;
  onOpenListing: (id: number) => void;
  onOpenOwner: (userId: string) => void;
  onOpenReviews: (listingId: number) => void;
  onEdit: () => void;
  onPromote: () => void;
  onUnpublish?: () => void;
  onPublish?: () => void;
  ownerStatus?: OwnerListingStatus;
  ownerRejectionReason?: string;
  onBook: (draft?: BookingDraft) => void;
  onToast: (message: string) => void;
};

export function ListingDetailPage({
  listing,
  allListings,
  favorite,
  favorites,
  onToggleFavorite,
  onToggleListingFavorite,
  onBack,
  onHome,
  onMap,
  onMessages,
  onProfile,
  onCreate,
  onOpenListing,
  onOpenOwner,
  onOpenReviews,
  onEdit,
  onPromote,
  onUnpublish,
  onPublish,
  ownerStatus,
  ownerRejectionReason,
  onBook,
  onToast,
}: DetailProps) {
  const controller = useListingDetailController({ listing, allListings, ownerStatus, onPublish, onUnpublish, onToast });
  const {
    activePhoto,
    setActivePhoto,
    descriptionExpanded,
    publicationConfirmation,
    setPublicationConfirmation,
    descriptionHeight,
    galleryOpen,
    locationOpen,
    setLocationOpen,
    dateSheetOpen,
    setDateSheetOpen,
    guestSheetOpen,
    setGuestSheetOpen,
    bookingDraft,
    headerProgress,
    mobileGalleryRef,
    descriptionRef,
    titleRef,
    photos,
    features,
    rules,
    similar,
    owner,
    ownerName,
    ownerRating,
    ownerReviews,
    ownerCanPromote,
    ownerCanUnpublish,
    ownerCanPublish,
    confirmPublicationChange,
    openGallery,
    closeGallery,
    handleLightboxTouchStart,
    handleLightboxTouchMove,
    handleLightboxTouchEnd,
    cancelLightboxTouch,
    share,
    scrollMobileGallery,
    handleMobileGalleryScroll,
    toggleDescription,
    applyDates,
    applyGuests,
  } = controller;
  const hasOwnerActions = Boolean(onEdit || (ownerCanPromote && !ownerCanUnpublish && !ownerCanPublish && onPromote) || (ownerCanUnpublish && onUnpublish) || (ownerCanPublish && onPublish));

  return (
    <div className="detail-page" style={{ '--detail-header-progress': headerProgress } as CSSProperties}>
      <DesktopTopbar active="search" onSearch={onHome} onMap={onMap} onMessages={onMessages} onProfile={onProfile} onCreate={onCreate} />

      <header className={`detail-floating-header ${headerProgress > 0.01 ? 'is-collapsing' : ''} ${headerProgress >= 0.99 ? 'show-title' : ''}`}>
        <div className="detail-floating-inner">
          <Pressable className="detail-round-button" aria-label="Назад" onClick={onBack}><ArrowLeft size={22} /></Pressable>
          <SectionTitle as="strong" className="ui-text--inherit-metrics" color="inherit" truncate>{getListingDetailTitle(listing)}</SectionTitle>
          <div className="detail-header-actions">
            {!listing.isOwn ? (
              <Pressable className={`detail-round-button ${favorite ? 'favorite' : ''}`} aria-label="Избранное" onClick={onToggleFavorite}>
                <Heart size={21} fill={favorite ? 'currentColor' : 'none'} />
              </Pressable>
            ) : null}
            <Pressable className="detail-round-button" aria-label="Поделиться" onClick={share}><Share2 size={21} /></Pressable>
          </div>
        </div>
      </header>

      <main className="detail-main">
        <ListingGallery
          listing={listing}
          photos={photos}
          activePhoto={activePhoto}
          mobileGalleryRef={mobileGalleryRef}
          onOpenPhoto={openGallery}
          onScrollMobileGallery={handleMobileGalleryScroll}
          onMoveMobileGallery={scrollMobileGallery}
        />

        <div className={`detail-content-wrap ${listing.isOwn && !hasOwnerActions ? 'without-booking-card' : ''}`}>
          <ListingDetailContent
            listing={listing}
            ownerStatus={ownerStatus}
            ownerRejectionReason={ownerRejectionReason}
            titleRef={titleRef}
            descriptionRef={descriptionRef}
            descriptionExpanded={descriptionExpanded}
            descriptionHeight={descriptionHeight}
            features={features}
            rules={rules}
            ownerName={ownerName}
            ownerAvatarUrl={owner?.avatarUrl}
            ownerRating={ownerRating}
            ownerReviews={ownerReviews}
            ownerVerified={owner?.verified !== false}
            ownerPhone={owner?.phone}
            similar={similar}
            favorites={favorites}
            onBack={onBack}
            onOpenReviews={onOpenReviews}
            onToggleDescription={toggleDescription}
            onOpenOwnerCard={() => listing.isOwn ? onProfile() : owner ? onOpenOwner(owner.id) : onToast('Профиль владельца недоступен')}
            onOpenLocation={() => setLocationOpen(true)}
            onToggleListingFavorite={onToggleListingFavorite}
            onOpenListing={onOpenListing}
          />

          <ListingDesktopBookingCard
            listing={listing}
            bookingDraft={bookingDraft}
            hasOwnerActions={hasOwnerActions}
            ownerCanPromote={ownerCanPromote}
            ownerCanUnpublish={ownerCanUnpublish}
            ownerCanPublish={ownerCanPublish}
            onEdit={onEdit}
            onPromote={onPromote}
            onUnpublish={onUnpublish}
            onPublish={onPublish}
            onBook={onBook}
            onOpenDates={() => setDateSheetOpen(true)}
            onOpenGuests={() => setGuestSheetOpen(true)}
            onRequestPublicationChange={setPublicationConfirmation}
          />
        </div>
      </main>

      <ListingMobileBookingBar
        listing={listing}
        bookingDraft={bookingDraft}
        hasOwnerActions={hasOwnerActions}
        ownerCanPromote={ownerCanPromote}
        ownerCanUnpublish={ownerCanUnpublish}
        ownerCanPublish={ownerCanPublish}
        onEdit={onEdit}
        onPromote={onPromote}
        onUnpublish={onUnpublish}
        onPublish={onPublish}
        onBook={onBook}
        onOpenDates={() => setDateSheetOpen(true)}
        onOpenGuests={() => setGuestSheetOpen(true)}
        onRequestPublicationChange={setPublicationConfirmation}
      />

      <ListingPublicationConfirm mode={publicationConfirmation} onClose={() => setPublicationConfirmation(null)} onConfirm={confirmPublicationChange} />

      <ListingDetailOverlays
        listing={listing}
        photos={photos}
        activePhoto={activePhoto}
        galleryOpen={galleryOpen}
        locationOpen={locationOpen}
        dateSheetOpen={dateSheetOpen}
        guestSheetOpen={guestSheetOpen}
        bookingDraft={bookingDraft}
        onActivePhotoChange={setActivePhoto}
        onCloseGallery={closeGallery}
        onCloseLocation={() => setLocationOpen(false)}
        onCloseDateSheet={() => setDateSheetOpen(false)}
        onCloseGuestSheet={() => setGuestSheetOpen(false)}
        onApplyDates={applyDates}
        onApplyGuests={applyGuests}
        onLightboxTouchStart={handleLightboxTouchStart}
        onLightboxTouchMove={handleLightboxTouchMove}
        onLightboxTouchEnd={handleLightboxTouchEnd}
        onLightboxTouchCancel={cancelLightboxTouch}
        onToast={onToast}
      />

    </div>
  );
}
