import type { Review } from '../model/types';

export const reviewSeed: Review[] = [
  {
    id: 501, requestId: 9188, rating: 5, body: 'Очень уютная квартира, чисто и тихо. Заселение прошло быстро, хозяин всегда был на связи.',
    authorId: 'me', authorName: 'Артём Иванов', createdAt: '2026-07-18T12:10:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 1, title: 'Уютная 1-комн. квартира', address: 'ул. Карбозова, 14, центр', city: 'Магнитогорск', coverUrl: '/listings/flat-1.jpg', ownerId: 'anna' },
    writtenByMe: true, receivedByMe: false,
    reply: { id: 801, body: 'Артём, спасибо за отзыв! Будем рады видеть вас снова.', status: 'active', createdAt: '2026-07-19T09:30:00+05:00' },
  },
  {
    id: 502, rating: 5, body: 'Квартира полностью соответствует фотографиям. Всё необходимое было на месте, район удобный.',
    authorId: '21', authorName: 'Илья Волков', authorAvatarUrl: '/chat/avatars/ilya.svg', createdAt: '2026-07-29T18:20:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
  },
  {
    id: 503, rating: 4, body: 'Хороший вариант для поездки на несколько дней. Чисто, заселились без проблем.',
    authorId: '22', authorName: 'Елена Смирнова', authorAvatarUrl: '/chat/avatars/elena.svg', createdAt: '2026-07-24T16:45:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
    reply: { id: 802, body: 'Спасибо, что поделились впечатлениями.', status: 'pending_moderation', createdAt: '2026-07-25T10:00:00+05:00' },
  },
  {
    id: 504, rating: 4, body: 'Свежий ремонт и удобная кровать. До центра добирались быстро.',
    authorId: '24', authorName: 'Анна Белова', authorAvatarUrl: '/chat/avatars/anna.svg', createdAt: '2026-07-12T14:00:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 5, title: 'Студия с новым ремонтом', address: 'ул. Гагарина, 22', city: 'Магнитогорск', coverUrl: '/listings/flat-2.jpg', ownerId: 'elena' },
    writtenByMe: false, receivedByMe: false,
  },
  {
    id: 505, requestId: 9174, rating: 3, body: 'В целом всё хорошо, но в отзыве была лишняя личная информация.',
    authorId: 'me', authorName: 'Артём Иванов', createdAt: '2026-06-28T11:15:00+05:00', status: 'rejected', rejectionReason: 'Удалите личные контактные данные и отправьте отзыв повторно.', editAttempts: 1, maxAttempts: 3,
    listing: { id: 3, title: 'Просторная 2-комн. квартира', address: 'ул. Зелёный Лог, 39', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'mikhail' },
    writtenByMe: true, receivedByMe: false,
  },
  {
    id: 506, rating: 5, body: 'Отличное расположение, рядом магазины и остановка. В квартире было тепло и очень чисто.',
    authorId: '25', authorName: 'Мария Соколова', createdAt: '2026-06-24T17:40:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
  },
  {
    id: 507, requestId: 9162, rating: 4, body: 'Удобное заселение и приятная квартира. Для короткой поездки подошло отлично.',
    authorId: 'me', authorName: 'Артём Иванов', createdAt: '2026-06-20T10:25:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 2, title: 'Современная студия', address: 'пр. Ленина, 87', city: 'Магнитогорск', coverUrl: '/listings/flat-2.jpg', ownerId: 'anna' },
    writtenByMe: true, receivedByMe: false,
  },
  {
    id: 508, rating: 4, body: 'Всё соответствует описанию. Хозяин быстро отвечал, ключи получили без ожидания.',
    authorId: '26', authorName: 'Дмитрий Орлов', createdAt: '2026-06-16T19:05:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
    reply: { id: 803, body: 'Спасибо за аккуратность и добрые слова!', status: 'active', createdAt: '2026-06-17T09:10:00+05:00' },
  },
  {
    id: 509, requestId: 9151, rating: 5, body: 'Тихий двор, удобная кровать и хорошая кухня. Вернусь сюда в следующую поездку.',
    authorId: 'me', authorName: 'Артём Иванов', createdAt: '2026-06-11T08:35:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 4, title: 'Уютная квартира у парка', address: 'ул. Советская, 31', city: 'Магнитогорск', coverUrl: '/listings/flat-1.jpg', ownerId: 'elena' },
    writtenByMe: true, receivedByMe: false,
  },
  {
    id: 510, rating: 5, body: 'Спасибо за гостеприимство. Всё было подготовлено заранее, фотографии полностью совпадают.',
    authorId: '27', authorName: 'Ольга Лебедева', createdAt: '2026-06-07T13:15:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
  },
  {
    id: 511, rating: 3, body: 'В целом всё нормально, но вечером было немного шумно со стороны дороги.',
    authorId: '28', authorName: 'Алексей Морозов', createdAt: '2026-05-30T20:45:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
  },
  {
    id: 512, requestId: 9138, rating: 4, body: 'Хороший вариант рядом с центром. Чистое бельё, удобный самостоятельный заезд.',
    authorId: 'me', authorName: 'Артём Иванов', createdAt: '2026-05-24T11:50:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 5, title: 'Студия с новым ремонтом', address: 'ул. Гагарина, 22', city: 'Магнитогорск', coverUrl: '/listings/flat-2.jpg', ownerId: 'elena' },
    writtenByMe: true, receivedByMe: false,
  },
  {
    id: 513, rating: 5, body: 'Останавливались семьёй на четыре дня. Места достаточно, кухня удобная, район спокойный.',
    authorId: '29', authorName: 'Наталья Крылова', createdAt: '2026-05-18T15:30:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
  },
  {
    id: 514, requestId: 9124, rating: 5, body: 'Очень внимательный хозяин и аккуратное жильё. Все вопросы решили ещё до приезда.',
    authorId: 'me', authorName: 'Артём Иванов', createdAt: '2026-05-12T09:20:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 1, title: 'Уютная 1-комн. квартира', address: 'ул. Карбозова, 14, центр', city: 'Магнитогорск', coverUrl: '/listings/flat-1.jpg', ownerId: 'anna' },
    writtenByMe: true, receivedByMe: false,
  },
  {
    id: 515, rating: 4, body: 'Квартира просторная, техника работает, связь с владельцем быстрая. Спасибо!',
    authorId: '30', authorName: 'Сергей Петров', createdAt: '2026-05-06T18:10:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
  },
  {
    id: 516, requestId: 9108, rating: 4, body: 'Заселились поздно вечером без проблем. Внутри спокойно и достаточно уютно.',
    authorId: 'me', authorName: 'Артём Иванов', createdAt: '2026-04-28T22:05:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 3, title: 'Просторная 2-комн. квартира', address: 'ул. Зелёный Лог, 39', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'mikhail' },
    writtenByMe: true, receivedByMe: false,
  },
  {
    id: 517, rating: 5, body: 'Чисто, удобно и без лишних формальностей. Особенно понравилось быстрое заселение.',
    authorId: '31', authorName: 'Кристина Майорова', createdAt: '2026-04-19T12:55:00+05:00', status: 'active', editAttempts: 0, maxAttempts: 3,
    listing: { id: 6, title: 'Двухкомнатная квартира в центре', address: 'пр. Металлургов, 9', city: 'Магнитогорск', coverUrl: '/listings/flat-3.jpg', ownerId: 'me' },
    writtenByMe: false, receivedByMe: true,
  },
];
