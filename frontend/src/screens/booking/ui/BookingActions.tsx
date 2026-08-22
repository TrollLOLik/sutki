import { Check } from 'lucide-react';
import type { Listing } from '@shared/data/listings';
import { BadgeText, BodyText, Button, ConfirmationDialog, DescriptionText, StickyActionBar } from '@ui';
import { formatBookingDate, formatRubles, nightsLabel } from '../model/bookingModel';
import type { BookingFormController } from '../model/useBookingForm';

export function BookingMobileActionBar({ listing, form }: { listing: Listing; form: BookingFormController }) {
  return (
    <StickyActionBar className={`booking-mobile-submit ${form.nights > 0 ? 'has-total' : ''}`}>
      <div className="booking-mobile-total" aria-hidden={form.nights < 1}>
        <span><DescriptionText as="strong" weight={500} color="default" truncate>{form.checkIn && form.checkOut ? `${formatBookingDate(form.checkIn)} — ${formatBookingDate(form.checkOut)}` : ''} · {nightsLabel(form.nights)}</DescriptionText><BadgeText color="muted" truncate>{formatRubles(listing.price)} ₽ × {nightsLabel(form.nights)}</BadgeText></span>
        <BodyText as="b" weight={500}>{formatRubles(form.total)} ₽</BodyText>
      </div>
      <Button type="submit" form="booking-request-form" size="md" mode="solid" tone="primary" stretched loading={form.submitting}>Отправить заявку</Button>
    </StickyActionBar>
  );
}

export function BookingSuccessDialog({ open, onOpenBookings }: { open: boolean; onOpenBookings: () => void }) {
  return <ConfirmationDialog open={open} onClose={() => {}} closeOnBackdrop={false} title="Заявка отправлена" description="Владелец рассмотрит её в ближайшее время." icon={<Check size={20} />} tone="success" singleAction actions={<Button size="sm" mode="solid" tone="primary" startIcon={<Check size={16} />} onClick={onOpenBookings}>Понятно</Button>} />;
}
