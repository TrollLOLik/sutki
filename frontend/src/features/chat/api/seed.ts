import type { ChatSnapshot, Conversation, ChatMessage } from '../model/types';

const now = Date.now();
const isoAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const dayAt = (daysAgo: number, hour: number, minute = 0) => {
  const date = new Date(now - daysAgo * 86_400_000);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

function message(
  conversationId: number,
  id: number,
  senderId: ChatMessage['senderId'],
  body: string,
  createdAt: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id,
    conversationId,
    senderId,
    kind: 'user',
    body,
    createdAt,
    delivery: senderId === 'me' ? 'read' : 'sent',
    ...extra,
  };
}

function extraConversations(): Conversation[] {
  const people = [
    ['Мария', 'Соколова'],
    ['Дмитрий', 'Орлов'],
    ['Ольга', 'Лебедева'],
    ['Никита', 'Волков'],
    ['Анна', 'Кузнецова'],
    ['Максим', 'Попов'],
    ['Екатерина', 'Морозова'],
    ['Сергей', 'Новиков'],
  ] as const;

  return people.map(([name, surname], index) => {
    const conversationId = 107 + index;
    const listingIndex = index % 3;
    return {
      id: conversationId,
      otherUser: {
        id: `demo-${conversationId}`,
        name,
        surname,
        avatarUrl: `/chat/avatars/${['anna', 'mikhail', 'elena'][listingIndex]}.svg`,
        online: index === 1 || index === 5,
      },
      listing: {
        id: listingIndex + 1,
        title: ['Уютная квартира в центре', 'Апартаменты с видом на город', 'Светлая студия у метро'][listingIndex],
        address: ['ул. Баумана, 38', 'ул. Чистопольская, 86', 'пр-т Победы, 61'][listingIndex],
        rooms: [2, 1, 0][listingIndex],
        price: [4200, 5400, 3100][listingIndex],
        coverUrl: `/listings/flat-${listingIndex + 1}.jpg`,
      },
      isOwner: index % 4 === 0,
      unreadCount: index % 3 === 0 ? 2 : 0,
      messages: [
        message(
          conversationId,
          7000 + index,
          `demo-${conversationId}`,
          ['Подскажите, свободны ли эти даты?', 'Спасибо, всё понятно.', 'Будем к указанному времени.'][index % 3],
          dayAt(6 + index, 18, 10 + index),
        ),
      ],
    } satisfies Conversation;
  });
}

const conversations: Conversation[] = [
  {
    id: 101,
    otherUser: {
      id: 'artem',
      name: 'Артем',
      surname: 'Кочетков',
      phone: '+7 999 124-58-90',
      avatarUrl: '/listings/flat-2.jpg',
      online: false,
      verified: true,
      rating: 4.9,
      reviewsCount: 31,
      city: 'Магнитогорск',
      memberSince: 'На сайте с августа 2026',
      responseTime: 'Обычно отвечает за 10 минут',
    },
    startedAtLabel: '01.08.2026 в 16:04',
    listing: {
      id: 1,
      title: 'Однокомнатная квартира',
      address: 'Сиреневый, д. 12/1',
      rooms: 1,
      price: 4200,
      coverUrl: '/listings/flat-1.jpg',
    },
    isOwner: true,
    unreadCount: 3,
    pinned: true,
    messages: [
      {
        id: 1001,
        conversationId: 101,
        senderId: null,
        kind: 'booking_status',
        createdAt: dayAt(1, 11, 38),
        booking: {
          requestId: 9201,
          event: 'new',
          startDate: '2026-08-04',
          endDate: '2026-08-12',
          guests: 2,
        },
      },
      message(101, 1002, 'me', '', dayAt(1, 12, 4), { deletedAt: dayAt(1, 12, 5) }),
      {
        id: 1003,
        conversationId: 101,
        senderId: null,
        kind: 'booking_status',
        createdAt: dayAt(1, 12, 38),
        booking: {
          requestId: 9202,
          event: 'new',
          startDate: '2026-08-12',
          endDate: '2026-08-19',
          guests: 2,
        },
      },
    ],
  },
  {
    id: 102,
    otherUser: {
      id: 'mikhail',
      name: 'Артем',
      surname: 'Кочетков',
      phone: '+7 917 555-31-12',
      avatarUrl: '/listings/flat-2.jpg',
      online: false,
      lastSeenAt: isoAgo(19),
      verified: true,
      rating: 4.8,
      reviewsCount: 18,
      city: 'Магнитогорск',
      memberSince: 'На сайте с августа 2023',
      responseTime: 'Обычно отвечает за 30 минут',
    },
    listing: {
      id: 3,
      title: 'Светлая студия у метро',
      address: 'пр-т Победы, 61',
      rooms: 0,
      price: 3100,
      coverUrl: '/listings/flat-2.jpg',
    },
    isOwner: true,
    unreadCount: 1,
    messages: [
      message(102, 2001, 'mikhail', 'Добрый день! Можно заселиться вечером после 21:00?', dayAt(1, 11, 12)),
      message(102, 2002, 'me', 'Да, позднее заселение возможно. Ключи передам через кейбокс.', dayAt(1, 11, 20)),
      message(102, 20021, 'mikhail', '', dayAt(1, 11, 21), {
        attachments: [
          { id: 'gallery-3-1', kind: 'image', name: 'Гостиная', url: '/listings/flat-1.jpg' },
          { id: 'gallery-3-2', kind: 'image', name: 'Спальня', url: '/listings/flat-2.jpg' },
          { id: 'gallery-3-3', kind: 'image', name: 'Кухня', url: '/listings/flat-3.jpg' },
        ],
      }),
      message(102, 20022, 'me', '', dayAt(1, 11, 22), {
        attachments: [
          { id: 'gallery-4-1', kind: 'image', name: 'Фото 1', url: '/listings/flat-3.jpg' },
          { id: 'gallery-4-2', kind: 'image', name: 'Фото 2', url: '/listings/flat-1.jpg' },
          { id: 'gallery-4-3', kind: 'image', name: 'Фото 3', url: '/listings/flat-2.jpg' },
          { id: 'gallery-4-4', kind: 'image', name: 'Фото 4', url: '/listings/flat-1.jpg' },
        ],
      }),
      {
        id: 2003,
        conversationId: 102,
        senderId: null,
        kind: 'booking_status',
        createdAt: isoAgo(21),
        booking: {
          requestId: 8401,
          event: 'new',
          startDate: '2026-08-09',
          endDate: '2026-08-12',
          guests: 1,
        },
      },
      message(102, 2004, 'mikhail', 'Отправил заявку. Если всё хорошо, подтвердите, пожалуйста.', isoAgo(18)),
      message(102, 2005, 'me', 'Хорошо, сейчас проверю даты и отвечу.', isoAgo(17), { replyToId: 2004 }),
    ],
  },
  {
    id: 103,
    otherUser: {
      id: 'elena',
      name: 'Александры',
      surname: '',
      phone: '+7 987 220-05-05',
      avatarUrl: '/chat/avatars/elena.svg',
      online: true,
      verified: true,
      rating: 5,
      reviewsCount: 9,
      city: 'Магнитогорск',
      memberSince: 'На сайте с января 2024',
      responseTime: 'Обычно отвечает за час',
    },
    listing: {
      id: 2,
      title: 'Апартаменты с видом на город',
      address: 'ул. Чистопольская, 86',
      rooms: 1,
      price: 5400,
      coverUrl: '/listings/flat-3.jpg',
    },
    isOwner: false,
    unreadCount: 0,
    messages: [
      message(103, 3001, 'me', 'Подскажите, пожалуйста, есть ли детская кроватка?', dayAt(3, 14, 8)),
      message(103, 3002, 'elena', 'Да, предоставим бесплатно. Ещё есть стульчик для кормления.', dayAt(3, 14, 16)),
      message(103, 3003, 'me', 'Спасибо! Тогда ближе к датам оформлю заявку.', dayAt(3, 14, 22)),
      message(103, 3004, 'elena', 'Хорошо, буду ждать 😊', dayAt(3, 14, 23)),
    ],
  },
  {
    id: 104,
    otherUser: {
      id: 'ilya',
      name: 'Илья',
      surname: 'Волков',
      avatarUrl: '/chat/avatars/ilya.svg',
      online: false,
      lastSeenAt: dayAt(1, 22, 10),
    },
    listing: {
      id: 1,
      title: 'Уютная квартира в центре',
      address: 'ул. Баумана, 38',
      rooms: 2,
      price: 4200,
      coverUrl: '/listings/flat-1.jpg',
    },
    isOwner: true,
    unreadCount: 0,
    messages: [
      message(104, 4001, 'ilya', 'Нас будет пятеро. Можно ли провести небольшой день рождения?', dayAt(5, 9, 30)),
      message(104, 4002, 'me', 'К сожалению, мероприятия в квартире запрещены правилами дома.', dayAt(5, 9, 41)),
      {
        id: 4003,
        conversationId: 104,
        senderId: null,
        kind: 'booking_status',
        createdAt: dayAt(5, 9, 45),
        booking: {
          requestId: 8395,
          event: 'rejected',
          startDate: '2026-08-15',
          endDate: '2026-08-16',
          guests: 5,
          reason: 'В объявлении запрещены вечеринки и мероприятия.',
        },
      },
    ],
  },
  {
    id: 105,
    otherUser: {
      id: 'support',
      name: 'Поддержка',
      surname: 'Сутки',
      avatarUrl: '/chat/avatars/support.svg',
      online: true,
    },
    isOwner: false,
    unreadCount: 0,
    messages: [
      {
        id: 5001,
        conversationId: 105,
        senderId: null,
        kind: 'system',
        body: 'Обращение №2481',
        createdAt: dayAt(8, 10, 0),
      },
      message(105, 5002, 'support', 'Здравствуйте! Проверили возврат — деньги отправлены в банк. Обычно зачисление занимает до 3 рабочих дней.', dayAt(8, 10, 14)),
      message(105, 5003, 'me', 'Понял, спасибо за помощь.', dayAt(8, 10, 19), {
        attachments: [{ id: 'doc-1', kind: 'document', name: 'Чек возврата.pdf', url: '#', sizeLabel: '284 КБ' }],
      }),
    ],
  },
  {
    id: 106,
    otherUser: {
      id: 'deleted',
      name: 'Удалённый',
      surname: 'профиль',
      deleted: true,
      online: false,
    },
    isOwner: false,
    unreadCount: 0,
    messages: [
      message(106, 6001, 'me', 'Здравствуйте, объявление ещё актуально?', dayAt(20, 12, 0)),
      message(106, 6002, 'deleted', 'Да, но даты лучше уточнить ближе к поездке.', dayAt(20, 12, 14)),
    ],
  },
  ...extraConversations(),
];

export function createSeedSnapshot(): ChatSnapshot {
  return { conversations };
}
