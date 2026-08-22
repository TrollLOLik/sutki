import { useEffect, useMemo, useRef, useState } from 'react';
import type { Listing } from '@shared/data/listings';
import { scrollToFirstValidationError } from '@shared/lib/forms/scrollToValidationError';
import { requestRepository } from '@features/requests';
import { daysBetween, isPhoneComplete, isoToday, type BookingErrors } from './bookingModel';

export interface BookingAuthDraft {
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  name: string;
  phone: string;
  message: string;
  submitAfterAuth: true;
}

interface BookingFormOptions {
  listing: Listing;
  initialCheckIn?: string | null;
  initialCheckOut?: string | null;
  initialGuests?: number;
  initialName?: string;
  initialPhone?: string;
  initialMessage?: string;
  initialSubmitAfterAuth?: boolean;
  isGuest?: boolean;
  onRequireAuth: (draft: BookingAuthDraft) => void;
  onOpenBookings: () => void;
}

export function useBookingForm({ listing, initialCheckIn, initialCheckOut, initialGuests = 1, initialName = '', initialPhone = '+7', initialMessage = '', initialSubmitAfterAuth = false, isGuest = false, onRequireAuth, onOpenBookings }: BookingFormOptions) {
  const minStart = useMemo(() => [isoToday(), listing.availableFrom].sort().at(-1) ?? isoToday(), [listing.availableFrom]);
  const [checkIn, setCheckIn] = useState(initialCheckIn ?? '');
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? '');
  const [guests, setGuests] = useState(Math.max(1, Math.min(listing.capacity, initialGuests)));
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState(initialMessage);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const autoSubmitStarted = useRef(false);
  const nights = daysBetween(checkIn, checkOut);
  const total = nights * listing.price;

  const submit = async () => {
    if (submitting) return;
    const nextErrors: BookingErrors = {};
    if (!checkIn || !checkOut || nights < 1) nextErrors.dates = 'Выберите даты заезда и выезда';
    if (!name.trim()) nextErrors.name = 'Укажите имя';
    if (!isPhoneComplete(phone, 'RU')) nextErrors.phone = 'Укажите полный номер телефона';
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length > 0) {
      scrollToFirstValidationError(document.getElementById('booking-request-form'));
      return;
    }
    if (isGuest) {
      onRequireAuth({ checkIn, checkOut, guests, name: name.trim(), phone, message: message.trim(), submitAfterAuth: true });
      return;
    }

    setSubmitting(true);
    try {
      await requestRepository.createOutgoing({
        listing: { id: listing.id, title: listing.title, address: listing.address, city: listing.cityName, price: listing.price, coverUrl: listing.coverUrl },
        guest: { name: name.trim(), phone },
        guests,
        message: message.trim(),
        startDate: checkIn,
        endDate: checkOut,
      });
      if (initialSubmitAfterAuth) onOpenBookings();
      else setSubmitted(true);
    } catch {
      setSubmitError('Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!initialSubmitAfterAuth || isGuest || autoSubmitStarted.current) return;
    autoSubmitStarted.current = true;
    void submit();
  }, [initialSubmitAfterAuth, isGuest]);

  return {
    minStart,
    checkIn,
    setCheckIn,
    checkOut,
    setCheckOut,
    guests,
    setGuests,
    name,
    setName,
    phone,
    setPhone,
    message,
    setMessage,
    errors,
    setErrors,
    submitted,
    submitting,
    submitError,
    nights,
    total,
    submit,
  };
}

export type BookingFormController = ReturnType<typeof useBookingForm>;
