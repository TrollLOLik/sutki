import { Ban, Clock3, CookingPot, Home, PawPrint, Snowflake, Tv, Users, WashingMachine, Waves, Wifi, type LucideIcon } from 'lucide-react';
import type { Listing } from '@shared/data/listings';

export interface ListingDetailFeature {
  label: string;
  Icon: LucideIcon;
}

export interface ListingDetailRule {
  label: string;
  Icon: LucideIcon;
}

export const listingPhotoSet = ['/listings/flat-1.jpg', '/listings/flat-2.jpg', '/listings/flat-3.jpg', '/listings/flat-1.jpg', '/listings/flat-2.jpg'];

const featureDictionary: Record<string, ListingDetailFeature> = {
  wifi: { label: 'Wi‑Fi', Icon: Wifi },
  fridge: { label: 'Холодильник', Icon: Snowflake },
  dishes: { label: 'Посуда', Icon: CookingPot },
  microwave: { label: 'Микроволновка', Icon: Waves },
  tvbox: { label: 'Телевизор', Icon: Tv },
  shower: { label: 'Стиральная машина', Icon: WashingMachine },
  grill: { label: 'Кухня', Icon: CookingPot },
};

export function formatListingPrice(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function formatReviewsCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} отзыв`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} отзыва`;
  return `${count} отзывов`;
}

export function formatRoomsCount(rooms: number) {
  if (rooms <= 0) return 'Студия';
  if (rooms === 1) return '1 комната';
  if (rooms >= 2 && rooms <= 4) return `${rooms} комнаты`;
  return `${rooms} комнат`;
}

export function getListingDetailTitle(listing: Listing) {
  if (listing.id === 1) return 'Уютная квартира на сутки в центре';
  if (listing.categoryId === 'cottage') return 'Уютный коттедж для отдыха';
  return listing.title;
}

export function buildListingFeatures(listing: Listing): ListingDetailFeature[] {
  const base = listing.serviceIds
    .map((id) => featureDictionary[id])
    .filter((item): item is ListingDetailFeature => Boolean(item));
  const additions: ListingDetailFeature[] = [
    { label: 'Кондиционер', Icon: Snowflake },
    { label: 'Балкон', Icon: Home },
  ];
  return [...base, ...additions].filter((item, index, array) => array.findIndex((entry) => entry.label === item.label) === index);
}

export function buildListingRules(listing: Listing): ListingDetailRule[] {
  return [
    { label: 'Заезд после 14:00', Icon: Clock3 },
    { label: 'Выезд до 12:00', Icon: Clock3 },
    { label: listing.smokingAllowed ? 'Курение разрешено' : 'Курение запрещено', Icon: listing.smokingAllowed ? Waves : Ban },
    { label: listing.petsAllowed ? 'Можно с питомцами' : 'Без питомцев', Icon: listing.petsAllowed ? PawPrint : Ban },
    { label: listing.childrenAllowed ? 'Можно с детьми' : 'Без детей', Icon: listing.childrenAllowed ? Users : Ban },
    { label: listing.eventsAllowed ? 'Мероприятия разрешены' : 'Без вечеринок', Icon: listing.eventsAllowed ? Users : Ban },
  ];
}
