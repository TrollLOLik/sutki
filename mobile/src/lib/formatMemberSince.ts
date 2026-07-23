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
  if (!createdAt) return 'В Дом рядом';

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'В Дом рядом';

  return `В Дом рядом с ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} года`;
}
