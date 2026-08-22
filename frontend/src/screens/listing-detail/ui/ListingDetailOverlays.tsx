import { ChevronLeft, ChevronRight, MapPin, Navigation, ShieldCheck, X } from 'lucide-react';
import type { TouchEventHandler } from 'react';
import type { Listing } from '@shared/data/listings';
import { DateSheet, GuestSheet } from '@features/search-filters';
import { BadgeText, BodyText, Button, DescriptionText, OverlaySurface, Pressable, SectionTitle } from '@shared/ui';
import type { BookingDraft } from '../model/listingDetailTypes';

interface ListingDetailOverlaysProps {
  listing: Listing;
  photos: string[];
  activePhoto: number;
  galleryOpen: boolean;
  locationOpen: boolean;
  dateSheetOpen: boolean;
  guestSheetOpen: boolean;
  bookingDraft: BookingDraft;
  onActivePhotoChange: (index: number) => void;
  onCloseGallery: () => void;
  onCloseLocation: () => void;
  onCloseDateSheet: () => void;
  onCloseGuestSheet: () => void;
  onApplyDates: (checkIn: string | null, checkOut: string | null) => void;
  onApplyGuests: (guests: number) => void;
  onLightboxTouchStart: TouchEventHandler<HTMLDivElement>;
  onLightboxTouchMove: TouchEventHandler<HTMLDivElement>;
  onLightboxTouchEnd: TouchEventHandler<HTMLDivElement>;
  onLightboxTouchCancel: () => void;
  onToast: (message: string) => void;
}

export function ListingDetailOverlays({
  listing,
  photos,
  activePhoto,
  galleryOpen,
  locationOpen,
  dateSheetOpen,
  guestSheetOpen,
  bookingDraft,
  onActivePhotoChange,
  onCloseGallery,
  onCloseLocation,
  onCloseDateSheet,
  onCloseGuestSheet,
  onApplyDates,
  onApplyGuests,
  onLightboxTouchStart,
  onLightboxTouchMove,
  onLightboxTouchEnd,
  onLightboxTouchCancel,
  onToast,
}: ListingDetailOverlaysProps) {
  return (
    <>
      <OverlaySurface open={galleryOpen} onClose={onCloseGallery} ariaLabel="Просмотр фотографий" layerClassName="detail-lightbox-layer" className="detail-lightbox">
        <header><Pressable aria-label="Закрыть" onClick={onCloseGallery}><X size={24} /></Pressable><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{activePhoto + 1} / {photos.length}</BodyText></header>
        <Pressable className="lightbox-arrow left" aria-label="Предыдущее фото" onClick={() => onActivePhotoChange((activePhoto - 1 + photos.length) % photos.length)}><ChevronLeft size={28} /></Pressable>
        <div className="lightbox-swipe-stage" onTouchStart={onLightboxTouchStart} onTouchMove={onLightboxTouchMove} onTouchEnd={onLightboxTouchEnd} onTouchCancel={onLightboxTouchCancel}>
          <img src={photos[activePhoto]} alt={`Фотография ${activePhoto + 1}`} draggable={false} />
        </div>
        <Pressable className="lightbox-arrow right" aria-label="Следующее фото" onClick={() => onActivePhotoChange((activePhoto + 1) % photos.length)}><ChevronRight size={28} /></Pressable>
        <div className="lightbox-thumbnails">{photos.map((photo, index) => <Pressable key={`${photo}-thumb-${index}`} className={activePhoto === index ? 'active' : ''} onClick={() => onActivePhotoChange(index)}><img src={photo} alt="" /></Pressable>)}</div>
      </OverlaySurface>

      <OverlaySurface open={locationOpen} onClose={onCloseLocation} ariaLabel="Расположение жилья" layerClassName="detail-location-layer" className="detail-location-surface">
        <div className="detail-location-map" role="region" aria-label={`Расположение жилья: ${listing.cityName}, ${listing.address}`}>
          <Pressable className="detail-location-close-floating" aria-label="Закрыть" onClick={onCloseLocation}><X size={25} /></Pressable>
          <span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><span className="map-road road-four" />
          <span className="map-block block-one" /><span className="map-block block-two" /><span className="map-block block-three" /><span className="map-park" />
          <span className="detail-location-radius" aria-hidden="true"><i /></span>
          <section className="detail-location-panel">
            <i className="detail-location-panel-handle" aria-hidden="true" />
            <div className="detail-location-panel-title"><SectionTitle className="ui-text--inherit-metrics" color="inherit">Расположение</SectionTitle><BadgeText className="ui-text--inherit-metrics" color="inherit">Приблизительно</BadgeText></div>
            <DescriptionText as="p" className="detail-location-panel-address ui-text--inherit-metrics" color="inherit"><MapPin size={18} /><span>{listing.cityName},<br />{listing.address}</span></DescriptionText>
            <div className="detail-location-safety"><span><ShieldCheck size={19} /></span><DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">Точный адрес и инструкции появятся после подтверждения бронирования.</DescriptionText></div>
            <Button className="detail-location-route" size="md" startIcon={<Navigation size={20} />} onClick={() => onToast('Маршрут будет доступен после подтверждения адреса')}>Построить маршрут</Button>
          </section>
        </div>
      </OverlaySurface>

      <DateSheet open={dateSheetOpen} checkIn={bookingDraft.checkIn} checkOut={bookingDraft.checkOut} minDate={listing.availableFrom} maxDate={listing.availableTo} onClose={onCloseDateSheet} onApply={onApplyDates} />
      <GuestSheet open={guestSheetOpen} value={bookingDraft.guests} max={listing.capacity} onClose={onCloseGuestSheet} onApply={onApplyGuests} />
    </>
  );
}
