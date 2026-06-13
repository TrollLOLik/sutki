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
