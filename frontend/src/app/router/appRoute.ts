import type { RequestDirection } from '@features/requests';

export type AppRoute =
  | { name: 'welcome' }
  | { name: 'auth-phone' }
  | { name: 'auth-email' }
  | { name: 'auth-code'; channel: 'phone' | 'email'; identifier: string }
  | { name: 'profile-setup' }
  | { name: 'home' }
  | { name: 'map'; listingId?: number }
  | { name: 'create'; editId?: number }
  | { name: 'promotion'; listingId?: number }
  | { name: 'profile' }
  | { name: 'my-listings'; tab?: 'all' | 'active' | 'pending' | 'unpublished' | 'rejected' }
  | { name: 'notifications' }
  | { name: 'my-reviews'; tab?: 'written' | 'received'; focusReviewId?: number }
  | { name: 'review-editor'; requestId: number }
  | { name: 'public-reviews'; kind: 'listing' | 'user'; subjectId: string }
  | { name: 'public-profile'; userId: string }
  | { name: 'ui-kit' }
  | { name: 'messages'; conversationId: number | null }
  | { name: 'requests'; direction: RequestDirection; requestId: number | null }
  | { name: 'listing'; listingId: number }
  | { name: 'booking'; listingId: number };

function decodeRouteSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseAppRoute(location?: string): AppRoute {
  const resolvedLocation = location
    ?? (typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search);
  const parsedLocation = new URL(resolvedLocation, 'http://app.local');
  const pathname = parsedLocation.pathname;
  if (/^\/welcome\/?$/.test(pathname)) return { name: 'welcome' };
  if (/^\/phone\/?$/.test(pathname)) return { name: 'auth-phone' };
  if (/^\/email\/?$/.test(pathname)) return { name: 'auth-email' };
  if (/^\/code\/?$/.test(pathname)) {
    const channel = parsedLocation.searchParams.get('channel') === 'email' ? 'email' : 'phone';
    return { name: 'auth-code', channel, identifier: parsedLocation.searchParams.get('identifier') ?? '' };
  }
  if (/^\/profile-setup\/?$/.test(pathname)) return { name: 'profile-setup' };
  if (/^\/my-listings\/?$/.test(pathname)) {
    const tab = parsedLocation.searchParams.get('tab');
    return ['all', 'active', 'pending', 'unpublished', 'rejected'].includes(tab ?? '')
      ? { name: 'my-listings', tab: tab as 'all' | 'active' | 'pending' | 'unpublished' | 'rejected' }
      : { name: 'my-listings' };
  }
  let match = pathname.match(/^\/review\/(\d+)\/?$/);
  if (match) return { name: 'review-editor', requestId: Number(match[1]) };
  match = pathname.match(/^\/reviews\/(listing|user)\/([^/]+)\/?$/);
  if (match) {
    const subjectId = decodeRouteSegment(match[2]);
    return subjectId === null
      ? { name: 'home' }
      : { name: 'public-reviews', kind: match[1] as 'listing' | 'user', subjectId };
  }
  if (/^\/my-reviews\/?$/.test(pathname)) {
    const tab = parsedLocation.searchParams.get('tab');
    const focusValue = Number(parsedLocation.searchParams.get('focus'));
    const focusReviewId = Number.isSafeInteger(focusValue) && focusValue > 0 ? focusValue : undefined;
    return tab === 'received' || tab === 'written'
      ? { name: 'my-reviews', tab, ...(focusReviewId ? { focusReviewId } : {}) }
      : { name: 'my-reviews', ...(focusReviewId ? { focusReviewId } : {}) };
  }
  if (/^\/notifications\/?$/.test(pathname)) return { name: 'notifications' };
  match = pathname.match(/^\/listing\/(\d+)\/?$/);
  if (match) return { name: 'listing', listingId: Number(match[1]) };
  match = pathname.match(/^\/booking\/(\d+)\/?$/);
  if (match) return { name: 'booking', listingId: Number(match[1]) };
  match = pathname.match(/^\/chat\/(\d+)\/?$/);
  if (match) return { name: 'messages', conversationId: Number(match[1]) };
  match = pathname.match(/^\/profile\/([^/]+)\/?$/);
  if (match) {
    const userId = decodeRouteSegment(match[1]);
    return userId === null ? { name: 'home' } : { name: 'public-profile', userId };
  }
  match = pathname.match(/^\/(incoming|bookings)(?:\/(\d+))?\/?$/);
  if (match) return { name: 'requests', direction: match[1] === 'incoming' ? 'incoming' : 'outgoing', requestId: match[2] ? Number(match[2]) : null };
  if (/^\/messages\/?$/.test(pathname)) return { name: 'messages', conversationId: null };
  if (/^\/map\/?$/.test(pathname)) {
    const listingId = Number(parsedLocation.searchParams.get('listing'));
    return Number.isSafeInteger(listingId) && listingId > 0 ? { name: 'map', listingId } : { name: 'map' };
  }
  if (/^\/create\/?$/.test(pathname)) {
    const editId = Number(parsedLocation.searchParams.get('editId'));
    return Number.isSafeInteger(editId) && editId > 0 ? { name: 'create', editId } : { name: 'create' };
  }
  if (/^\/promotion\/?$/.test(pathname)) {
    const listingId = Number(parsedLocation.searchParams.get('listing'));
    return Number.isSafeInteger(listingId) && listingId > 0 ? { name: 'promotion', listingId } : { name: 'promotion' };
  }
  if (/^\/profile\/?$/.test(pathname)) return { name: 'profile' };
  if (/^\/ui-kit\/?$/.test(pathname)) return { name: 'ui-kit' };
  return { name: 'home' };
}

export function appRoutePath(route: AppRoute): string {
  switch (route.name) {
    case 'welcome': return '/welcome';
    case 'auth-phone': return '/phone';
    case 'auth-email': return '/email';
    case 'auth-code': {
      const params = new URLSearchParams({ channel: route.channel, identifier: route.identifier });
      return '/code?' + params.toString();
    }
    case 'profile-setup': return '/profile-setup';
    case 'home': return '/';
    case 'map': return route.listingId ? '/map?listing=' + route.listingId : '/map';
    case 'create': return route.editId ? '/create?editId=' + route.editId : '/create';
    case 'promotion': return route.listingId ? '/promotion?listing=' + route.listingId : '/promotion';
    case 'profile': return '/profile';
    case 'my-listings': return route.tab && route.tab !== 'all' ? '/my-listings?tab=' + route.tab : '/my-listings';
    case 'notifications': return '/notifications';
    case 'my-reviews': {
      const params = new URLSearchParams();
      if (route.tab) params.set('tab', route.tab);
      if (route.focusReviewId) params.set('focus', String(route.focusReviewId));
      const query = params.toString();
      return query ? '/my-reviews?' + query : '/my-reviews';
    }
    case 'review-editor': return '/review/' + route.requestId;
    case 'public-reviews': return '/reviews/' + route.kind + '/' + encodeURIComponent(route.subjectId);
    case 'public-profile': return '/profile/' + encodeURIComponent(route.userId);
    case 'ui-kit': return '/ui-kit';
    case 'messages': return route.conversationId == null ? '/messages' : '/chat/' + route.conversationId;
    case 'requests': {
      const base = route.direction === 'incoming' ? '/incoming' : '/bookings';
      return route.requestId == null ? base : base + '/' + route.requestId;
    }
    case 'listing': return '/listing/' + route.listingId;
    case 'booking': return '/booking/' + route.listingId;
  }
}

export function routeTitle(route: AppRoute, listingTitle?: string): string {
  switch (route.name) {
    case 'welcome': return 'Добро пожаловать';
    case 'auth-phone': return 'Вход по телефону';
    case 'auth-email': return 'Вход по email';
    case 'auth-code': return 'Подтверждение входа';
    case 'profile-setup': return 'Создание профиля';
    case 'home': return 'Аренда квартир посуточно';
    case 'map': return 'Карта объявлений';
    case 'create': return 'Новое объявление';
    case 'promotion': return 'Продвижение';
    case 'profile': return 'Профиль';
    case 'my-listings': return 'Мои объявления';
    case 'notifications': return 'Уведомления';
    case 'my-reviews': return 'Мои отзывы';
    case 'review-editor': return 'Оставить отзыв';
    case 'public-reviews': return 'Отзывы';
    case 'public-profile': return 'Профиль пользователя';
    case 'ui-kit': return 'Sutki UI Kit';
    case 'messages': return route.conversationId == null ? 'Сообщения' : 'Переписка';
    case 'requests': return route.requestId == null ? (route.direction === 'incoming' ? 'Входящие заявки' : 'Мои брони') : 'Детали заявки';
    case 'listing': return listingTitle ?? 'Объявление';
    case 'booking': return 'Заявка — ' + (listingTitle ?? 'объявление');
  }
}
