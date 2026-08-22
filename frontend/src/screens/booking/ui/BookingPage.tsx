import type { Listing } from '@shared/data/listings';
import { DesktopTopbar } from '@widgets/app-navigation';
import { ListPageHeader } from '@ui';
import { useBookingForm, type BookingAuthDraft } from '../model/useBookingForm';
import { BookingMobileActionBar, BookingSuccessDialog } from './BookingActions';
import { BookingFormContent } from './BookingFormContent';

interface BookingPageProps {
  listing: Listing;
  onBack: () => void;
  onHome: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onCreate: () => void;
  onOpenBookings: () => void;
  initialCheckIn?: string | null;
  initialCheckOut?: string | null;
  initialGuests?: number;
  initialName?: string;
  initialPhone?: string;
  initialMessage?: string;
  initialSubmitAfterAuth?: boolean;
  isGuest?: boolean;
  onRequireAuth: (draft: BookingAuthDraft) => void;
}

export function BookingPage({ listing, onBack, onHome, onMap, onMessages, onProfile, onCreate, onOpenBookings, initialCheckIn = null, initialCheckOut = null, initialGuests = 1, initialName = '', initialPhone = '+7', initialMessage = '', initialSubmitAfterAuth = false, isGuest = false, onRequireAuth }: BookingPageProps) {
  const form = useBookingForm({ listing, initialCheckIn, initialCheckOut, initialGuests, initialName, initialPhone, initialMessage, initialSubmitAfterAuth, isGuest, onRequireAuth, onOpenBookings });

  return (
    <div className="booking-page">
      <DesktopTopbar active="search" onSearch={onHome} onMap={onMap} onMessages={onMessages} onProfile={onProfile} onCreate={onCreate} />
      <ListPageHeader presentation="mobile" className="booking-mobile-header" title="Заявка на аренду" onBack={onBack} />
      <main className="booking-main">
        <ListPageHeader presentation="desktop" className="booking-title-row" title="Заявка на аренду" subtitle="Укажите даты и контакты — владелец сначала подтвердит доступность." onBack={onBack} />
        <BookingFormContent listing={listing} form={form} />
      </main>
      <BookingMobileActionBar listing={listing} form={form} />
      <BookingSuccessDialog open={form.submitted} onOpenBookings={onOpenBookings} />
    </div>
  );
}
