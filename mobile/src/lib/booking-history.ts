import type { Booking } from '@/types/booking';

type Tone = 'success' | 'info' | 'neutral' | 'primary';

/** Terminal outcome of a booking shown in the "История" tab. */
export type HistoryKind = 'completed' | 'cancelled' | 'rejected';

/**
 * Derives the terminal outcome of a booking. The backend stores both
 * tenant-cancelled and owner-rejected requests as `cancelled`; they're told
 * apart by `rejection_reason` (only the owner's reject sets it). A `confirmed`
 * booking that reaches the history scope has run its course → completed.
 */
export function historyKind(b: Booking): HistoryKind {
  if (b.status === 'confirmed') return 'completed';
  if (b.rejection_reason && b.rejection_reason.trim().length > 0) return 'rejected';
  return 'cancelled';
}

interface HistoryMeta {
  label: string;
  tone: Tone;
}

const META: Record<HistoryKind, HistoryMeta> = {
  completed: { label: 'Завершена', tone: 'success' },
  cancelled: { label: 'Отменена', tone: 'neutral' },
  rejected: { label: 'Отклонена', tone: 'neutral' },
};

export function historyMeta(kind: HistoryKind): HistoryMeta {
  return META[kind];
}

/** Only completed stays can be reviewed. */
export function canReview(kind: HistoryKind): boolean {
  return kind === 'completed';
}
