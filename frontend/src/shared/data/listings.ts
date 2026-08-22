import type { CategoryId } from '../types/filters';

export type ListingStatusBadge = 'available_today' | 'verified' | 'new';

export type ListingOwner = {
  id: string;
  name: string;
  surname: string;
  phone?: string;
  avatarUrl?: string;
  online?: boolean;
  verified?: boolean;
  rating?: number;
  reviewsCount?: number;
  city?: string;
  memberSince?: string;
  responseTime?: string;
  listingsCount?: number;
};

export type ListingReference = {
  id: string;
  apiId: number;
  name: string;
};

export type ListingPOI = {
  name: string;
  type: string;
  distance: number;
};

export type Listing = {
  id: number;
  coverUrl: string;
  rooms: number;
  title: string;
  address: string;
  city: string;
  cityName: string;
  area: number;
  capacity: number;
  views: number;
  price: number;
  rating: number;
  reviewsCount: number;
  categoryId: CategoryId;
  serviceIds: string[];
  smokingAllowed: boolean;
  petsAllowed: boolean;
  childrenAllowed: boolean;
  eventsAllowed: boolean;
  isOwn?: boolean;
  availableFrom: string;
  availableTo: string;
  createdAt: string;
  promoted?: 'top' | 'highlight';
  viewed?: boolean;
  statusBadge?: ListingStatusBadge;
  owner?: ListingOwner;
  description?: string;
  photos?: string[];
  services?: ListingReference[];
  categories?: ListingReference[];
  checkInAfter?: string | null;
  checkOutBefore?: string | null;
  locationSummary?: string | null;
  reviewsSummary?: string | null;
  pois?: ListingPOI[];
  lat?: number | null;
  lng?: number | null;
  locationRadius?: number;
};

const anna: ListingOwner = {
  id: 'anna', name: 'Анна', surname: 'Петрова', phone: '+7 999 124-58-90',
  avatarUrl: '/chat/avatars/anna.svg', online: true, verified: true, rating: 4.9, reviewsCount: 31,
  city: 'Казань', memberSince: 'На сайте с марта 2021', responseTime: 'Обычно отвечает за 10 минут',
};

const mikhail: ListingOwner = {
  id: 'mikhail', name: 'Михаил', surname: 'Орлов', phone: '+7 917 555-31-12',
  avatarUrl: '/chat/avatars/mikhail.svg', verified: true, rating: 4.8, reviewsCount: 18,
  city: 'Магнитогорск', memberSince: 'На сайте с августа 2023', responseTime: 'Обычно отвечает за 30 минут',
};

const elena: ListingOwner = {
  id: 'elena', name: 'Елена', surname: 'Соколова', phone: '+7 987 220-05-05',
  avatarUrl: '/chat/avatars/elena.svg', online: true, verified: true, rating: 5, reviewsCount: 9,
  city: 'Магнитогорск', memberSince: 'На сайте с января 2024', responseTime: 'Обычно отвечает за час',
};

const currentUser: ListingOwner = {
  id: 'me', name: 'Артём', surname: 'Иванов', verified: true, rating: 4.9, reviewsCount: 18,
  city: 'Магнитогорск', memberSince: 'На сайте с 2022 года', responseTime: 'Обычно отвечает за 15 минут',
};

export const listings: Listing[] = [
  {
    id: 1,
    coverUrl: '/listings/flat-1.jpg',
    rooms: 1,
    title: 'Уютная 1-комн. квартира',
    address: 'ул. Карбозова, 14, центр',
    city: 'Магнитогорск, 10 мин',
    cityName: 'Магнитогорск',
    area: 40,
    capacity: 4,
    views: 128,
    price: 2300,
    rating: 4.8,
    reviewsCount: 128,
    categoryId: 'one-room',
    serviceIds: ['wifi', 'fridge', 'dishes', 'microwave'],
    smokingAllowed: false,
    petsAllowed: true,
    childrenAllowed: true,
    eventsAllowed: false,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-26',
    viewed: true,
    statusBadge: 'available_today',
    owner: anna,
  },
  {
    id: 2,
    coverUrl: '/listings/flat-2.jpg',
    rooms: 0,
    title: 'Современная студия',
    address: 'пр. Ленина, 87',
    city: 'Магнитогорск, 7 мин',
    cityName: 'Магнитогорск',
    area: 28,
    capacity: 2,
    views: 96,
    price: 2000,
    rating: 4.9,
    reviewsCount: 96,
    categoryId: 'apartments',
    serviceIds: ['wifi', 'fridge', 'tvbox', 'shower'],
    smokingAllowed: false,
    petsAllowed: false,
    childrenAllowed: true,
    eventsAllowed: false,
    availableFrom: '2026-08-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-28',
    statusBadge: 'verified',
    owner: elena,
  },
  {
    id: 3,
    coverUrl: '/listings/flat-3.jpg',
    rooms: 2,
    title: 'Просторная 2-комн. квартира',
    address: 'ул. Зелёный Лог, 39',
    city: 'Магнитогорск, 15 мин',
    cityName: 'Магнитогорск',
    area: 60,
    capacity: 6,
    views: 32,
    price: 3200,
    rating: 4.7,
    reviewsCount: 32,
    categoryId: 'multi-room',
    serviceIds: ['wifi', 'fridge', 'dishes', 'grill', 'microwave'],
    smokingAllowed: true,
    petsAllowed: true,
    childrenAllowed: true,
    eventsAllowed: true,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-20',
    promoted: 'highlight',
    statusBadge: 'new',
    owner: mikhail,
  },
  {
    id: 4,
    coverUrl: '/listings/flat-1.jpg',
    rooms: 1,
    title: 'Светлая квартира рядом с парком',
    address: 'ул. Советская, 31',
    city: 'Магнитогорск, 8 мин',
    cityName: 'Магнитогорск',
    area: 44,
    capacity: 3,
    views: 71,
    price: 2700,
    rating: 4.9,
    reviewsCount: 71,
    categoryId: 'one-room',
    serviceIds: ['wifi', 'fridge', 'dishes', 'microwave', 'tvbox'],
    smokingAllowed: false,
    petsAllowed: false,
    childrenAllowed: true,
    eventsAllowed: false,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-22',
    promoted: 'top',
    statusBadge: 'available_today',
    owner: mikhail,
  },
  {
    id: 5,
    coverUrl: '/listings/flat-2.jpg',
    rooms: 0,
    title: 'Студия с новым ремонтом',
    address: 'ул. Гагарина, 22',
    city: 'Магнитогорск, 12 мин',
    cityName: 'Магнитогорск',
    area: 31,
    capacity: 2,
    views: 44,
    price: 2400,
    rating: 5,
    reviewsCount: 44,
    categoryId: 'apartments',
    serviceIds: ['wifi', 'fridge', 'shower'],
    smokingAllowed: false,
    petsAllowed: true,
    childrenAllowed: false,
    eventsAllowed: false,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-29',
    statusBadge: 'new',
    owner: elena,
  },
  {
    id: 6,
    coverUrl: '/listings/flat-3.jpg',
    rooms: 2,
    title: 'Двухкомнатная квартира в центре',
    address: 'пр. Металлургов, 9',
    city: 'Магнитогорск, 5 мин',
    cityName: 'Магнитогорск',
    area: 58,
    capacity: 5,
    views: 18,
    price: 3500,
    rating: 4.8,
    reviewsCount: 18,
    categoryId: 'multi-room',
    serviceIds: ['wifi', 'fridge', 'dishes', 'microwave', 'tvbox', 'shower'],
    smokingAllowed: false,
    petsAllowed: false,
    childrenAllowed: true,
    eventsAllowed: true,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-18',
    isOwn: true,
    statusBadge: 'verified',
    owner: currentUser,
  },
  {
    id: 7,
    coverUrl: '/listings/flat-1.jpg',
    rooms: 3,
    title: 'Трёхкомнатная для большой семьи',
    address: 'ул. Труда, 18',
    city: 'Челябинск, центр',
    cityName: 'Челябинск',
    area: 82,
    capacity: 8,
    views: 163,
    price: 5100,
    rating: 4.9,
    reviewsCount: 54,
    categoryId: 'multi-room',
    serviceIds: ['wifi', 'fridge', 'dishes', 'grill', 'microwave', 'tvbox'],
    smokingAllowed: false,
    petsAllowed: true,
    childrenAllowed: true,
    eventsAllowed: true,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-30',
    owner: anna,
  },
  {
    id: 8,
    coverUrl: '/listings/flat-2.jpg',
    rooms: 5,
    title: 'Коттедж с зоной барбекю',
    address: 'пос. Западный, ул. Лесная, 4',
    city: 'Челябинск, 20 мин',
    cityName: 'Челябинск',
    area: 180,
    capacity: 12,
    views: 210,
    price: 9200,
    rating: 4.8,
    reviewsCount: 38,
    categoryId: 'cottage',
    serviceIds: ['wifi', 'fridge', 'dishes', 'grill', 'microwave', 'tvbox', 'shower'],
    smokingAllowed: true,
    petsAllowed: true,
    childrenAllowed: true,
    eventsAllowed: true,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-12',
    promoted: 'top',
    owner: mikhail,
  },
  {
    id: 9,
    coverUrl: '/listings/flat-3.jpg',
    rooms: 1,
    title: 'Квартира у набережной',
    address: 'ул. Кремлёвская, 7',
    city: 'Казань, 6 мин',
    cityName: 'Казань',
    area: 47,
    capacity: 4,
    views: 88,
    price: 4700,
    rating: 4.7,
    reviewsCount: 29,
    categoryId: 'one-room',
    serviceIds: ['wifi', 'fridge', 'dishes', 'microwave'],
    smokingAllowed: false,
    petsAllowed: false,
    childrenAllowed: true,
    eventsAllowed: false,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-15',
    owner: anna,
  },
  {
    id: 10,
    coverUrl: '/listings/flat-1.jpg',
    rooms: 2,
    title: 'Апартаменты рядом с метро',
    address: 'ул. Белинского, 44',
    city: 'Екатеринбург, 4 мин',
    cityName: 'Екатеринбург',
    area: 66,
    capacity: 5,
    views: 145,
    price: 5600,
    rating: 4.9,
    reviewsCount: 61,
    categoryId: 'apartments',
    serviceIds: ['wifi', 'fridge', 'dishes', 'microwave', 'tvbox', 'shower'],
    smokingAllowed: false,
    petsAllowed: true,
    childrenAllowed: true,
    eventsAllowed: false,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-25',
    owner: elena,
  },
  {
    id: 11,
    coverUrl: '/listings/flat-2.jpg',
    rooms: 4,
    title: 'Большая квартира в историческом центре',
    address: 'Невский проспект, 102',
    city: 'Санкт-Петербург, 3 мин',
    cityName: 'Санкт-Петербург',
    area: 110,
    capacity: 9,
    views: 302,
    price: 11500,
    rating: 5,
    reviewsCount: 84,
    categoryId: 'multi-room',
    serviceIds: ['wifi', 'fridge', 'dishes', 'microwave', 'tvbox', 'shower'],
    smokingAllowed: false,
    petsAllowed: false,
    childrenAllowed: true,
    eventsAllowed: true,
    availableFrom: '2026-09-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-07',
    promoted: 'highlight',
    owner: mikhail,
  },
  {
    id: 12,
    coverUrl: '/listings/flat-3.jpg',
    rooms: 1,
    title: 'Лофт для выходных',
    address: 'ул. Баумана, 25',
    city: 'Казань, центр',
    cityName: 'Казань',
    area: 52,
    capacity: 3,
    views: 76,
    price: 6200,
    rating: 4.8,
    reviewsCount: 22,
    categoryId: 'apartments',
    serviceIds: ['wifi', 'fridge', 'grill', 'tvbox'],
    smokingAllowed: true,
    petsAllowed: false,
    childrenAllowed: false,
    eventsAllowed: true,
    availableFrom: '2026-01-01',
    availableTo: '2027-12-31',
    createdAt: '2026-07-27',
    owner: anna,
  },
];
