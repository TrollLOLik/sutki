import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import type { RefObject } from 'react';
import type { Listing } from '@shared/data/listings';
import { BadgeText, BodyText, Pressable } from '@shared/ui';
import { ListingStatusBadge } from '@entities/listing';

interface ListingGalleryProps {
  listing: Listing;
  photos: string[];
  activePhoto: number;
  mobileGalleryRef: RefObject<HTMLDivElement | null>;
  onOpenPhoto: (index: number) => void;
  onScrollMobileGallery: () => void;
  onMoveMobileGallery: (direction: number) => void;
}

export function ListingGallery({
  listing,
  photos,
  activePhoto,
  mobileGalleryRef,
  onOpenPhoto,
  onScrollMobileGallery,
  onMoveMobileGallery,
}: ListingGalleryProps) {
  return (
    <section className="detail-gallery" aria-label="Фотографии объявления">
      {!listing.isOwn && listing.statusBadge ? <ListingStatusBadge status={listing.statusBadge} className="detail-status-badge" /> : null}
      <div className="detail-desktop-gallery">
        <Pressable className="detail-gallery-main" onClick={() => onOpenPhoto(0)}>
          <img src={photos[0]} alt="Гостиная квартиры" />
        </Pressable>
        <div className="detail-gallery-side">
          {photos.slice(1, 5).map((photo, index) => (
            <Pressable key={`${photo}-${index}`} onClick={() => onOpenPhoto(index + 1)}>
              <img src={photo} alt={`Интерьер, фотография ${index + 2}`} />
              {index === 3 ? <BodyText className="ui-text--inherit-metrics" color="inherit" weight={500}><ImageIcon size={17} />Все фото</BodyText> : null}
            </Pressable>
          ))}
        </div>
      </div>

      <div ref={mobileGalleryRef} className="detail-mobile-gallery" onScroll={onScrollMobileGallery}>
        {photos.map((photo, index) => (
          <Pressable key={`${photo}-mobile-${index}`} onClick={() => onOpenPhoto(index)}>
            <img src={photo} alt={`Интерьер, фотография ${index + 1}`} />
          </Pressable>
        ))}
      </div>
      <Pressable className="mobile-gallery-arrow left" aria-label="Предыдущее фото" onClick={() => onMoveMobileGallery(-1)}><ChevronLeft size={20} /></Pressable>
      <Pressable className="mobile-gallery-arrow right" aria-label="Следующее фото" onClick={() => onMoveMobileGallery(1)}><ChevronRight size={20} /></Pressable>
      <BadgeText className="detail-photo-count ui-text--inherit-metrics" color="inherit">{activePhoto + 1} / {photos.length}</BadgeText>
    </section>
  );
}
