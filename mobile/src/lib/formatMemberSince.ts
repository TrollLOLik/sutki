const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

export function formatMemberSince(createdAt?: string | null): string {
  if (!createdAt) return 'В ВИГАЖ';

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'В ВИГАЖ';

  return `В ВИГАЖ с ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} года`;
}
