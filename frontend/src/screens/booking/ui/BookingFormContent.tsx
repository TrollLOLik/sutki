import { CalendarDays, MessageCircle, Send, UserRound } from 'lucide-react';
import type { Listing } from '@shared/data/listings';
import { CalendarRange } from '@features/search-filters';
import {
  BadgeText,
  BodyText,
  Button,
  CompactAlert,
  Counter,
  DescriptionText,
  Divider,
  Field,
  HeroTitle,
  KeyValueRow,
  PhoneField,
  SectionTitle,
  Surface,
  TextField,
} from '@ui';
import { formatBookingDate, formatRubles, guestsLabel, maskPhone, nightsLabel } from '../model/bookingModel';
import type { BookingFormController } from '../model/useBookingForm';

interface BookingPartProps {
  listing: Listing;
  form: BookingFormController;
}

export function BookingListingSummary({ listing }: { listing: Listing }) {
  return (
    <Surface level="raised" radius="xl" className="booking-listing-summary">
      <div className="booking-listing-image"><img src={listing.coverUrl} alt="Интерьер квартиры" /></div>
      <div>
        <BodyText as="strong" weight={500}>{listing.title}</BodyText>
        <DescriptionText as="p">{listing.cityName}, {listing.address}</DescriptionText>
        <BodyText as="strong" weight={500} color="accent">{formatRubles(listing.price)} ₽ <BadgeText color="muted">/ сутки</BadgeText></BodyText>
      </div>
    </Surface>
  );
}

export function BookingDatesSection({ listing, form }: BookingPartProps) {
  return (
    <Surface level="raised" radius="xl" className="booking-form-section">
      <div className="booking-section-heading"><div><SectionTitle>Даты проживания</SectionTitle><DescriptionText as="p">Выберите день заезда и выезда</DescriptionText></div></div>
      <Field id="booking-dates" className="booking-dates-field" error={form.errors.dates} messageId="booking-dates-error" data-validation-error={form.errors.dates ? 'true' : undefined}>
        <CalendarRange className={form.errors.dates ? 'has-error' : ''} value={{ start: form.checkIn || null, end: form.checkOut || null }} minDate={form.minStart} maxDate={listing.availableTo} onChange={(range) => { form.setCheckIn(range.start ?? ''); form.setCheckOut(range.end ?? ''); form.setErrors((current) => ({ ...current, dates: undefined })); }} />
        <div className="booking-unavailable-legend"><span className="booking-unavailable-legend-mark" aria-hidden="true" /><DescriptionText as="small">Недоступные даты</DescriptionText></div>
        {form.checkIn && form.checkOut && form.nights > 0 ? <CompactAlert className="booking-date-result" tone="success" icon={<CalendarDays />}>{formatBookingDate(form.checkIn)} — {formatBookingDate(form.checkOut)} · {nightsLabel(form.nights)}</CompactAlert> : null}
      </Field>
    </Surface>
  );
}

export function BookingGuestsSection({ listing, form }: BookingPartProps) {
  return (
    <Surface level="raised" radius="xl" className="booking-form-section">
      <div className="booking-section-heading"><div><SectionTitle>Гости</SectionTitle></div></div>
      <div className="booking-guests-stepper">
        <div><BodyText as="strong" weight={500}>{guestsLabel(form.guests)}</BodyText><BadgeText color="muted">Включая детей</BadgeText></div>
        <Counter value={form.guests} min={1} max={listing.capacity} label="Количество гостей" onChange={form.setGuests} />
      </div>
    </Surface>
  );
}

export function BookingContactSection({ form }: { form: BookingFormController }) {
  return (
    <Surface level="raised" radius="xl" className="booking-form-section">
      <div className="booking-section-heading"><div><SectionTitle>Контактные данные</SectionTitle></div></div>
      <div className="booking-contact-grid">
        <Field id="booking-name" className="booking-contact-field" label="Имя" labelFor="booking-name-input" error={form.errors.name} messageId="booking-name-error" data-validation-error={form.errors.name ? 'true' : undefined}>
          <TextField id="booking-name-input" size="md" before={<UserRound size={18} />} invalid={Boolean(form.errors.name)} aria-describedby={form.errors.name ? 'booking-name-error' : undefined} value={form.name} onChange={(event) => { form.setName(event.target.value); form.setErrors((current) => ({ ...current, name: undefined })); }} placeholder="Имя" autoComplete="name" />
        </Field>
        <Field id="booking-phone" className="booking-contact-field" label="Телефон" labelFor="booking-phone-input" error={form.errors.phone} messageId="booking-phone-error" data-validation-error={form.errors.phone ? 'true' : undefined}>
          <PhoneField id="booking-phone-input" size="md" invalid={Boolean(form.errors.phone)} aria-describedby={form.errors.phone ? 'booking-phone-error' : undefined} value={form.phone.replace(/^\+7\s?/, '')} onChange={(event) => { form.setPhone(maskPhone(`+7 ${event.target.value}`)); form.setErrors((current) => ({ ...current, phone: undefined })); }} />
        </Field>
        <Field className="booking-contact-field booking-message-field" label="Комментарий" labelFor="booking-message-input">
          <TextField id="booking-message-input" size="md" before={<MessageCircle size={18} />} value={form.message} maxLength={500} onChange={(event) => form.setMessage(event.target.value)} placeholder="Комментарий (необязательно)" />
        </Field>
      </div>
    </Surface>
  );
}

export function BookingSummaryCard({ listing, form }: BookingPartProps) {
  return (
    <Surface as="aside" level="raised" radius="xl" className="booking-summary-card">
      <SectionTitle>Ваша заявка</SectionTitle>
      <KeyValueRow className="booking-summary-row" label="Даты" value={form.checkIn && form.checkOut ? `${formatBookingDate(form.checkIn)} — ${formatBookingDate(form.checkOut)}` : 'Не выбраны'} />
      <KeyValueRow className="booking-summary-row" label="Гости" value={guestsLabel(form.guests)} />
      <Divider />
      <KeyValueRow className="booking-summary-row" label={`${formatRubles(listing.price)} ₽ × ${form.nights > 0 ? nightsLabel(form.nights) : '—'}`} value={form.nights > 0 ? `${formatRubles(form.total)} ₽` : '—'} />
      <div className="booking-summary-total"><BodyText weight={500}>Итого</BodyText><HeroTitle as="strong">{form.nights > 0 ? `${formatRubles(form.total)} ₽` : '—'}</HeroTitle></div>
      {form.submitError ? <CompactAlert tone="danger">{form.submitError}</CompactAlert> : null}
      <Button className="booking-primary-button" type="submit" size="md" mode="solid" tone="primary" stretched loading={form.submitting} startIcon={<Send size={18} />}>Отправить заявку</Button>
      <BadgeText as="p" color="muted">Оплата сейчас не требуется</BadgeText>
    </Surface>
  );
}

export function BookingFormContent({ listing, form }: BookingPartProps) {
  return (
    <form id="booking-request-form" className="booking-layout" noValidate onSubmit={(event) => { event.preventDefault(); void form.submit(); }}>
      <div className="booking-form-column">
        <BookingListingSummary listing={listing} />
        <BookingDatesSection listing={listing} form={form} />
        <BookingGuestsSection listing={listing} form={form} />
        <BookingContactSection form={form} />
      </div>
      <BookingSummaryCard listing={listing} form={form} />
    </form>
  );
}
