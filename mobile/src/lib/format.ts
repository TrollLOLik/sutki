import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/** Thousands-grouped ruble amount using a non-breaking space (e.g. 2000 -> "2 000"). */
export function formatRub(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

/** Price label used across cards and the listing detail (e.g. "2 000 ₽ / сутки"). */
export function formatPricePerNight(value: number): string {
  return `${formatRub(value)}\u00A0₽ / сутки`;
}

/** Human-readable rooms label from the legacy `count_room` string. */
export function formatRooms(rooms: string): string {
  const n = Number(rooms);
  if (!Number.isFinite(n) || n <= 0) return 'Студия';
  return `${n}-комн.`;
}

/** Localized day-month-year label, e.g. "1 июля 2026". */
export function formatDateRu(date: Date): string {
  return format(date, 'd MMMM yyyy', { locale: ru });
}

/** Booking date range, e.g. "1 — 5 июля 2026" or "с 1 июля 2026" (open-ended). */
export function formatDateRangeRu(start: Date, end: Date | null): string {
  if (!end) return `с ${formatDateRu(start)}`;
  return `${formatDateRu(start)} — ${formatDateRu(end)}`;
}

/** Guests count with a Russian plural suffix, e.g. "1 гость", "3 гостя". */
export function formatGuests(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = 'гостей';
  if (mod10 === 1 && mod100 !== 11) word = 'гость';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'гостя';
  return `${count} ${word}`;
}
