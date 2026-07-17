import { type Href, useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useNavigationHistoryStore } from '@/store/navigation-history';
import { useSessionStore } from '@/store/session';

const ignoredPaths = new Set(['/welcome', '/email', '/phone', '/code', '/profile-setup']);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function titleFor(pathname: string, titleParam?: string) {
  if (pathname === '/') return 'Поиск';
  if (pathname === '/map') return 'Карта';
  if (pathname === '/messages') return 'Сообщения';
  if (pathname === '/profile') return 'Профиль';
  if (pathname === '/filters') return 'Фильтры';
  if (pathname === '/create') return 'Объявление';
  if (pathname === '/notifications') return 'Уведомления';
  if (pathname === '/my-listings') return 'Мои объявления';
  if (pathname === '/my-reviews') return 'Мои отзывы';
  if (pathname === '/bookings') return 'Мои брони';
  if (pathname === '/incoming') return 'Входящие заявки';
  if (pathname.startsWith('/chat/')) return titleParam || 'Чат';
  if (pathname.match(/^\/listing\/[^/]+\/promote$/)) return 'Продвижение';
  if (pathname.match(/^\/listing\/[^/]+\/location$/)) return 'Расположение';
  if (pathname.startsWith('/listing/')) return titleParam || 'Объявление';
  if (pathname.startsWith('/profile/')) return titleParam || 'Профиль пользователя';
  if (pathname.startsWith('/incoming/')) return 'Заявка гостя';
  if (pathname.startsWith('/bookings/') || pathname.startsWith('/booking/')) return 'Бронирование';
  if (pathname.startsWith('/reviews/')) return 'Отзывы';
  if (pathname.startsWith('/review/')) return 'Новый отзыв';
  if (pathname.startsWith('/payments/')) return 'Оплата';
  return 'Предыдущий экран';
}

export function useNavigationHistoryTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ title?: string | string[] }>();
  const status = useSessionStore((state) => state.status);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || status === 'onboarding') {
      useNavigationHistoryStore.getState().clear();
      return;
    }
    if (ignoredPaths.has(pathname)) return;
    useNavigationHistoryStore.getState().record({
      href: pathname as Href,
      key: pathname,
      title: titleFor(pathname, firstParam(params.title)),
    });
  }, [params.title, pathname, status]);
}
