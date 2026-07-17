import type { BookingStatus } from '@/types/booking';

type Tone = 'success' | 'info' | 'neutral' | 'primary';

interface StatusMeta {
  label: string;
  tone: Tone;
}

const META: Record<BookingStatus, StatusMeta> = {
  pending: { label: 'На рассмотрении', tone: 'info' },
  in_progress: { label: 'На рассмотрении', tone: 'info' },
  confirmed: { label: 'Подтверждена', tone: 'success' },
  active: { label: 'Проживание', tone: 'success' },
  cancelled: { label: 'Отклонена', tone: 'neutral' },
  pending_verification: { label: 'Ожидает OTP', tone: 'primary' },
};

const FALLBACK: StatusMeta = { label: 'Неизвестно', tone: 'neutral' };

/** Russian label + badge tone for a booking status (unknown → neutral). */
export function bookingStatusMeta(status: string): StatusMeta {
  return META[status as BookingStatus] ?? FALLBACK;
}

/** Only pending bookings can be cancelled by the tenant. */
export function isPending(status: string): boolean {
  return status === 'pending' || status === 'in_progress' || status === 'pending_verification';
}
