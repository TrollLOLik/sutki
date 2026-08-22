import { ChevronRight, Clock3, Users } from 'lucide-react';
import type { Listing } from '@shared/data/listings';
import { formatDateRange, formatGuests } from '@shared/types/filters';
import { BodyText, Button, DescriptionText, Pressable, StickyActionBar } from '@shared/ui';
import { ListingOwnerActions } from '@entities/listing';
import type { BookingDraft } from '../model/listingDetailTypes';

interface ListingBookingPanelsProps {
  listing: Listing;
  bookingDraft: BookingDraft;
  hasOwnerActions: boolean;
  ownerCanPromote: boolean;
  ownerCanUnpublish: boolean;
  ownerCanPublish: boolean;
  onEdit: () => void;
  onPromote: () => void;
  onUnpublish?: () => void;
  onPublish?: () => void;
  onBook: (draft?: BookingDraft) => void;
  onOpenDates: () => void;
  onOpenGuests: () => void;
  onRequestPublicationChange: (mode: 'publish' | 'unpublish') => void;
}

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function OwnerActions({ ownerCanPromote, ownerCanUnpublish, ownerCanPublish, onEdit, onPromote, onUnpublish, onPublish, onRequestPublicationChange }: Omit<ListingBookingPanelsProps, 'listing' | 'bookingDraft' | 'hasOwnerActions' | 'onBook' | 'onOpenDates' | 'onOpenGuests'>) {
  return <ListingOwnerActions onEdit={onEdit} onPromote={ownerCanPromote && !ownerCanUnpublish && !ownerCanPublish ? onPromote : undefined} onUnpublish={ownerCanUnpublish && onUnpublish ? () => onRequestPublicationChange('unpublish') : undefined} onPublish={ownerCanPublish && onPublish ? () => onRequestPublicationChange('publish') : undefined} />;
}

export function ListingDesktopBookingCard(props: ListingBookingPanelsProps) {
  const { listing, bookingDraft, hasOwnerActions, onBook, onOpenDates, onOpenGuests } = props;
  if (listing.isOwn && !hasOwnerActions) return null;

  return (
    <aside className={`detail-booking-card ${listing.isOwn ? 'owner-mode' : ''}`}>
      <div className="detail-booking-price"><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{rub(listing.price)} ₽</BodyText><DescriptionText className="ui-text--inherit-metrics" color="inherit">за сутки</DescriptionText></div>
      {!listing.isOwn ? (
        <>
          <div className="detail-booking-fields">
            <Pressable onClick={onOpenDates}><Clock3 size={18} /><span><DescriptionText as="small" className="ui-text--inherit-metrics" color="inherit">Даты</DescriptionText><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{formatDateRange(bookingDraft.checkIn, bookingDraft.checkOut)}</BodyText></span><ChevronRight size={17} /></Pressable>
            <Pressable onClick={onOpenGuests}><Users size={18} /><span><DescriptionText as="small" className="ui-text--inherit-metrics" color="inherit">Гости</DescriptionText><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{formatGuests(bookingDraft.guests)}</BodyText></span><ChevronRight size={17} /></Pressable>
          </div>
          <Button className="detail-primary-cta" size="md" stretched onClick={() => onBook(bookingDraft)}>Оставить заявку</Button>
          <DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">Пока без оплаты — владелец сначала подтвердит доступность.</DescriptionText>
        </>
      ) : <OwnerActions {...props} />}
    </aside>
  );
}

export function ListingMobileBookingBar(props: ListingBookingPanelsProps) {
  const { listing, bookingDraft, hasOwnerActions, onBook } = props;
  if (listing.isOwn && !hasOwnerActions) return null;

  return (
    <StickyActionBar className={`detail-mobile-booking-bar ${listing.isOwn ? 'owner-mode' : ''}`}>
      {listing.isOwn ? <OwnerActions {...props} /> : (
        <>
          <span><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{rub(listing.price)} ₽</BodyText><DescriptionText as="small" className="ui-text--inherit-metrics" color="inherit">за сутки</DescriptionText></span>
          <Button size="md" onClick={() => onBook(bookingDraft)}>Оставить заявку</Button>
        </>
      )}
    </StickyActionBar>
  );
}
