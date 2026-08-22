export type RoomFilter = 'studio' | '1' | '2' | '3' | '4' | '5plus';
export type ListingSort = 'newest' | 'oldest' | 'popular';
export type CategoryId = 'apartments' | 'one-room' | 'multi-room' | 'cottage';

export type SearchFilters = {
  sort: ListingSort;
  city: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  rooms: RoomFilter[];
  categoryId: CategoryId | null;
  serviceIds: string[];
  favoritesOnly: boolean;
  showOwnListings: boolean;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  childrenAllowed: boolean;
  eventsAllowed: boolean;
};

export const defaultFilters: SearchFilters = {
  sort: 'newest',
  city: null,
  checkIn: null,
  checkOut: null,
  guests: 1,
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  rooms: [],
  categoryId: null,
  serviceIds: [],
  favoritesOnly: false,
  showOwnListings: false,
  smokingAllowed: false,
  petsAllowed: false,
  childrenAllowed: false,
  eventsAllowed: false,
};

export const roomOptions: { label: string; value: RoomFilter }[] = [
  { label: 'Студия', value: 'studio' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5+', value: '5plus' },
];

export const quickRoomOptions: { label: string; value: 'all' | RoomFilter }[] = [
  { label: 'Все', value: 'all' },
  { label: 'Студия', value: 'studio' },
  { label: '1-комн.', value: '1' },
  { label: '2-комн.', value: '2' },
  { label: '3-комн.', value: '3' },
  { label: '4-комн.', value: '4' },
  { label: '5+ комнат', value: '5plus' },
];

export const categoryOptions: { label: string; value: CategoryId }[] = [
  { label: 'Квартиры', value: 'apartments' },
  { label: 'Однокомнатная', value: 'one-room' },
  { label: 'Многокомнатная', value: 'multi-room' },
  { label: 'Коттедж', value: 'cottage' },
];

export const serviceOptions = [
  { id: 'fridge', label: 'Холодильник' },
  { id: 'wifi', label: 'Wi fi' },
  { id: 'dishes', label: 'Посуда' },
  { id: 'grill', label: 'Гриль' },
  { id: 'microwave', label: 'Микроволновая печь' },
  { id: 'tvbox', label: 'ТВ приставка' },
  { id: 'shower', label: 'Душевая кабина' },
] as const;

export const sortOptions: { label: string; value: ListingSort }[] = [
  { label: 'Сначала новые', value: 'newest' },
  { label: 'Сначала старые', value: 'oldest' },
  { label: 'Популярные', value: 'popular' },
];

export function toggleItem<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function countActiveFilters(filters: SearchFilters): number {
  return (
    filters.rooms.length +
    filters.serviceIds.length +
    (filters.city ? 1 : 0) +
    (filters.checkIn && filters.checkOut ? 1 : 0) +
    (filters.priceMin != null || filters.priceMax != null ? 1 : 0) +
    (filters.areaMin != null || filters.areaMax != null ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.guests !== defaultFilters.guests ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.showOwnListings !== defaultFilters.showOwnListings ? 1 : 0) +
    (filters.smokingAllowed ? 1 : 0) +
    (filters.petsAllowed ? 1 : 0) +
    (filters.childrenAllowed ? 1 : 0) +
    (filters.eventsAllowed ? 1 : 0)
  );
}

export function formatGuests(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value} гость`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${value} гостя`;
  return `${value} гостей`;
}

export function formatDateRange(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return 'Любые даты';
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Любые даты';
  const month = new Intl.DateTimeFormat('ru-RU', { month: 'short' });
  const startMonth = month.format(start).replace('.', '');
  const endMonth = month.format(end).replace('.', '');
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} — ${end.getDate()} ${startMonth}`;
  }
  return `${start.getDate()} ${startMonth} — ${end.getDate()} ${endMonth}`;
}

export function pluralVariants(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'вариант';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'варианта';
  return 'вариантов';
}
