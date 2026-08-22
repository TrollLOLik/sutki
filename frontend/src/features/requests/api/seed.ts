import type { RentalRequest, RequestPerson } from '../model/types';

const me: RequestPerson = {
  id: 1,
  profileId: 'artem',
  name: 'Артём',
  surname: 'Иванов',
  phone: '+7 (999) 123-45-67',
  verified: true,
  rating: 4.9,
  reviewsCount: 18,
};

const owners: RequestPerson[] = [
  { id: 11, profileId: 'anna', name: 'Анна', surname: 'Кузнецова', phone: '+7 (912) 555-32-18', avatarUrl: '/chat/avatars/anna.svg', verified: true, rating: 4.9, reviewsCount: 86 },
  { id: 12, profileId: 'mikhail', name: 'Михаил', surname: 'Соколов', phone: '+7 (922) 341-08-21', avatarUrl: '/chat/avatars/mikhail.svg', verified: true, rating: 4.8, reviewsCount: 54 },
  { id: 13, profileId: 'elena', name: 'Елена', surname: 'Орлова', phone: '+7 (951) 488-17-09', avatarUrl: '/chat/avatars/elena.svg', verified: true, rating: 5, reviewsCount: 31 },
];

const guests: RequestPerson[] = [
  { id: 21, profileId: 'ilya', name: 'Илья', surname: 'Волков', phone: '+7 (900) 220-14-72', avatarUrl: '/chat/avatars/ilya.svg', verified: true, rating: 4.8, reviewsCount: 12 },
  { id: 22, profileId: 'elena', name: 'Елена', surname: 'Смирнова', phone: '+7 (908) 102-44-31', avatarUrl: '/chat/avatars/elena.svg', verified: true, rating: 5, reviewsCount: 9 },
  { id: 23, profileId: 'deleted', deleted: true, name: 'Удалённый', surname: 'профиль', phone: '+7 (963) 177-83-55', rating: 0, reviewsCount: 0 },
  { id: 24, profileId: 'anna', name: 'Анна', surname: 'Белова', phone: '+7 (999) 010-20-30', avatarUrl: '/chat/avatars/anna.svg', verified: true, rating: 4.7, reviewsCount: 5 },
];

export const requestSeed: RentalRequest[] = [
  {
    id: 8401,
    direction: 'incoming',
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', price: 3500, coverUrl: '/listings/flat-3.jpg', owner: me },
    guest: guests[0], guests: 2, message: 'Здравствуйте! Приедем вечером, ориентировочно к 20:00. Подскажите, возможно ли позднее заселение?',
    startDate: '2026-08-03', endDate: '2026-08-07', status: 'in_progress', createdAt: '2026-07-31T08:42:00+05:00', updatedAt: '2026-07-31T08:42:00+05:00', chatConversationId: 104,
  },
  {
    id: 8402,
    direction: 'incoming',
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', price: 3500, coverUrl: '/listings/flat-3.jpg', owner: me },
    guest: guests[1], guests: 3, message: 'Будем с ребёнком. Нужна детская кроватка, если есть.',
    startDate: '2026-08-12', endDate: '2026-08-15', status: 'pending', createdAt: '2026-07-30T19:20:00+05:00', updatedAt: '2026-07-30T19:20:00+05:00', chatConversationId: 103,
  },
  {
    id: 8403,
    direction: 'incoming',
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', price: 3500, coverUrl: '/listings/flat-3.jpg', owner: me },
    guest: guests[2], guests: 1, message: '',
    startDate: '2026-08-20', endDate: '2026-08-22', status: 'pending_verification', createdAt: '2026-07-29T12:05:00+05:00', updatedAt: '2026-07-29T12:05:00+05:00', chatConversationId: 102,
  },
  {
    id: 8398,
    direction: 'incoming',
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', price: 3500, coverUrl: '/listings/flat-3.jpg', owner: me },
    guest: guests[3], guests: 2, message: 'Спасибо!',
    startDate: '2026-07-25', endDate: '2026-07-28', status: 'completed', confirmedAt: '2026-07-20T10:12:00+05:00', createdAt: '2026-07-19T21:30:00+05:00', updatedAt: '2026-07-20T10:12:00+05:00', chatConversationId: 101,
  },
  {
    id: 8395,
    direction: 'incoming',
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', price: 3500, coverUrl: '/listings/flat-3.jpg', owner: me },
    guest: guests[2], guests: 4, message: 'Хотели провести небольшую встречу.',
    startDate: '2026-07-15', endDate: '2026-07-17', status: 'cancelled', rejectionReason: 'На выбранные даты квартира уже занята.', cancelledBy: 'owner', createdAt: '2026-07-12T09:15:00+05:00', updatedAt: '2026-07-12T11:03:00+05:00', chatConversationId: 104,
  },
  {
    id: 9174,
    direction: 'outgoing',
    listing: { id: 3, title: 'Просторная 2-комн. квартира', address: 'ул. Зелёный Лог, 39', city: 'Магнитогорск', price: 3200, coverUrl: '/listings/flat-3.jpg', owner: owners[1] },
    guest: me, guests: 2, message: '',
    startDate: '2026-06-22', endDate: '2026-06-26', status: 'completed', confirmedAt: '2026-06-15T12:00:00+05:00', createdAt: '2026-06-14T09:00:00+05:00', updatedAt: '2026-06-26T12:00:00+05:00', reviewAvailable: true, reviewLabel: 'Изменить отзыв', reviewStatus: 'rejected', chatConversationId: 102,
  },  {
    id: 9201,
    direction: 'outgoing',
    listing: { id: 1, title: 'Уютная 1-комн. квартира', address: 'ул. Карбозова, 14, центр', city: 'Магнитогорск', price: 2300, coverUrl: '/listings/flat-1.jpg', owner: owners[0] },
    guest: me, guests: 2, message: 'Здравствуйте! Заедем после 18:00.',
    startDate: '2026-08-05', endDate: '2026-08-09', status: 'in_progress', createdAt: '2026-07-31T07:35:00+05:00', updatedAt: '2026-07-31T07:35:00+05:00', chatConversationId: 101,
  },
  {
    id: 9202,
    direction: 'outgoing',
    listing: { id: 3, title: 'Просторная 2-комн. квартира', address: 'ул. Зелёный Лог, 39', city: 'Магнитогорск', price: 3200, coverUrl: '/listings/flat-3.jpg', owner: owners[1] },
    guest: me, guests: 3, message: 'Нужен ранний заезд около 11 утра.',
    startDate: '2026-08-14', endDate: '2026-08-18', status: 'confirmed', confirmedAt: '2026-07-29T18:00:00+05:00', createdAt: '2026-07-29T15:20:00+05:00', updatedAt: '2026-07-29T18:00:00+05:00', chatConversationId: 102,
  },
  {
    id: 9203,
    direction: 'outgoing',
    listing: { id: 5, title: 'Студия с новым ремонтом', address: 'ул. Гагарина, 22', city: 'Магнитогорск', price: 2400, coverUrl: '/listings/flat-2.jpg', owner: owners[2] },
    guest: me, guests: 1, message: '',
    startDate: '2026-07-27', endDate: '2026-07-30', status: 'completed', confirmedAt: '2026-07-20T15:45:00+05:00', createdAt: '2026-07-19T09:10:00+05:00', updatedAt: '2026-07-30T12:00:00+05:00', reviewAvailable: true, reviewLabel: 'Оставить отзыв', chatConversationId: 103,
  },
  {
    id: 9204,
    direction: 'outgoing',
    listing: { id: 2, title: 'Современная студия', address: 'пр. Ленина, 87', city: 'Магнитогорск', price: 2000, coverUrl: '/listings/flat-2.jpg', owner: owners[0] },
    guest: me, guests: 2, message: 'Планы изменились.',
    startDate: '2026-07-22', endDate: '2026-07-25', status: 'cancelled', cancelledBy: 'guest', createdAt: '2026-07-17T14:35:00+05:00', updatedAt: '2026-07-18T08:10:00+05:00', chatConversationId: 103,
  },
  {
    id: 9205,
    direction: 'outgoing',
    listing: { id: 4, title: 'Светлая квартира рядом с парком', address: 'ул. Советская, 31', city: 'Магнитогорск', price: 2700, coverUrl: '/listings/flat-1.jpg', owner: owners[1] },
    guest: me, guests: 2, message: '',
    startDate: '2026-07-10', endDate: '2026-07-13', status: 'cancelled', rejectionReason: 'Владелец не сможет принять гостей в эти даты.', cancelledBy: 'owner', createdAt: '2026-07-08T16:15:00+05:00', updatedAt: '2026-07-08T19:25:00+05:00', chatConversationId: 102,
  },
];
