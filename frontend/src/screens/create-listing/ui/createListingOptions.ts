import {
  Bath,
  ArrowUpDown,
  Blinds,
  BedDouble,
  Building2,
  Car,
  CookingPot,
  DoorOpen,
  Home,
  Microwave,
  Refrigerator,
  Snowflake,
  Sparkles,
  ShowerHead,
  Trees,
  Tv,
  WashingMachine,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_OPTIONS: Array<{ value: string; label: string; description: string; Icon: LucideIcon }> = [
  { value: 'apartments', label: 'Апартаменты', description: 'Апартаменты или апарт-отель', Icon: Sparkles },
  { value: 'house', label: 'Дом', description: 'Отдельный жилой дом', Icon: Home },
  { value: 'apartment', label: 'Квартира', description: 'Отдельная квартира целиком', Icon: Building2 },
  { value: 'room', label: 'Комната', description: 'Отдельная комната в жилье', Icon: DoorOpen },
  { value: 'cottage', label: 'Коттедж', description: 'Коттедж или загородный дом', Icon: Trees },
  { value: 'studio', label: 'Студия', description: 'Жильё со свободной планировкой', Icon: BedDouble },
];

export const ROOM_OPTIONS = [
  { value: 'studio', label: 'Студия' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5+' },
] as const;

export const AMENITIES: Array<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: 'wifi', label: 'Wi‑Fi', Icon: Wifi },
  { id: 'balcony', label: 'Балкон', Icon: Blinds },
  { id: 'bath', label: 'Ванна', Icon: Bath },
  { id: 'shower', label: 'Душ', Icon: ShowerHead },
  { id: 'ac', label: 'Кондиционер', Icon: Snowflake },
  { id: 'elevator', label: 'Лифт', Icon: ArrowUpDown },
  { id: 'microwave', label: 'Микроволновая печь', Icon: Microwave },
  { id: 'parking', label: 'Парковка', Icon: Car },
  { id: 'stove', label: 'Плита', Icon: CookingPot },
  { id: 'dishes', label: 'Посуда', Icon: CookingPot },
  { id: 'washer', label: 'Стиральная машина', Icon: WashingMachine },
  { id: 'tv', label: 'Телевизор', Icon: Tv },
  { id: 'fridge', label: 'Холодильник', Icon: Refrigerator },
];

export const CITY_SUGGESTIONS = ['Челябинск', 'Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Сочи', 'Магнитогорск'] as const;

export const RULE_OPTIONS = {
  smoking: [
    { value: 'allowed', label: 'Можно' },
    { value: 'forbidden', label: 'Запрещено' },
    { value: 'on_balcony', label: 'На балконе' },
  ],
  pets: [
    { value: 'allowed', label: 'Можно' },
    { value: 'forbidden', label: 'Запрещено' },
    { value: 'on_request', label: 'По запросу' },
  ],
  children: [
    { value: 'allowed', label: 'Можно' },
    { value: 'forbidden', label: 'Запрещено' },
    { value: 'on_request', label: 'По запросу' },
  ],
  events: [
    { value: 'allowed', label: 'Можно' },
    { value: 'forbidden', label: 'Запрещено' },
    { value: 'on_request', label: 'По запросу' },
  ],
} as const;
