import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, LockKeyhole, LogIn } from 'lucide-react';
import { useListingSearch } from '@features/listing-search';
import { useDemoSession } from '@features/auth';
import type { RequestDirection } from '@features/requests';
import type { HomeTab } from '@pages/home';
import type { BookingDraft } from '@pages/listing-detail';
import { listings } from '@shared/data/listings';
import { useSmoothScroll } from '@shared/lib/scroll/ScrollSystem';
import { useAppScrollChrome } from '@shared/lib/scroll/useAppScrollChrome';
import { BodyText, BottomSheet, Button, ConfirmationDialog, SectionTitle, Snackbar } from '@ui';
import { CustomTabBar } from '@widgets/app-navigation';
import { startDemoEventBridge } from './model/demoEventBridge';
import { useMobileKeyboardViewport } from './model/useMobileKeyboardViewport';
import { usePerformancePrompt } from './model/usePerformancePrompt';
import { appRoutePath, routeTitle, type AppRoute } from './router/appRoute';
import { AppRouteView } from './router/AppRouteView';
import { useAppRouter } from './router/useAppRouter';
import { AppSearchLayers, type AppSearchLayer } from './ui/AppSearchLayers';
import { PrimaryRouteFrame } from './ui/PrimaryRouteFrame';

const primaryRouteOrder: Partial<Record<AppRoute['name'], number>> = {
  home: 0,
  map: 1,
  create: 2,
  messages: 3,
  profile: 4,
};

function bottomNavigationTab(route: AppRoute): HomeTab | null {
  if (route.name === 'home') return 'search';
  if (route.name === 'map') return 'map';
  if (route.name === 'messages' && route.conversationId === null) return 'messages';
  if (route.name === 'profile') return 'profile';
  return null;
}

export interface AppProps {
  initialLocation?: string;
}

export function App({ initialLocation }: AppProps) {
  useEffect(() => startDemoEventBridge(), []);
  const { route, navigationDirection, scrollRestoration, navigate, back } = useAppRouter(initialLocation);
  const [reportedTabBar, setReportedTabBar] = useState<{ route: string; hidden: boolean }>({ route: '', hidden: false });
  const session = useDemoSession();
  const search = useListingSearch();
  const [layer, setLayer] = useState<AppSearchLayer>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>();
  const [guestAuthPromptOpen, setGuestAuthPromptOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [visibleMessage, setVisibleMessage] = useState('');
  const showMessage = useCallback((nextMessage: string) => {
    setVisibleMessage(nextMessage);
    setMessage(nextMessage);
  }, []);
  const clearMessage = useCallback(() => setMessage(''), []);
  const { scrollTo } = useSmoothScroll();
  const pendingAuthRouteRef = useRef<AppRoute | null>(null);
  const catalogAlreadyShownRef = useRef(false);
  const initialSessionRouteResolvedRef = useRef(false);

  useEffect(() => {
    if (route.name === 'home') catalogAlreadyShownRef.current = true;
  }, [route.name]);

  const performancePrompt = usePerformancePrompt();

  useEffect(() => {
    const authRoute = route.name === 'welcome' || route.name === 'auth-phone' || route.name === 'auth-email' || route.name === 'auth-code';
    const protectedRoute = route.name === 'profile' || route.name === 'my-listings' || route.name === 'create' || route.name === 'promotion' || route.name === 'messages' || route.name === 'requests' || route.name === 'booking' || route.name === 'my-reviews' || route.name === 'review-editor' || route.name === 'notifications';
    const guestProtectedRoute = route.name === 'my-listings' || route.name === 'create' || route.name === 'promotion' || route.name === 'requests' || route.name === 'my-reviews' || route.name === 'review-editor' || route.name === 'notifications';
    const replaceSessionRoute = (nextRoute: AppRoute) => navigate(nextRoute, {
      replace: true,
      animate: initialSessionRouteResolvedRef.current,
    });
    if (session.status === 'unauthenticated' && !authRoute) {
      if (protectedRoute) pendingAuthRouteRef.current = route;
      replaceSessionRoute({ name: 'welcome' });
      return;
    }
    if (session.status === 'onboarding' && route.name !== 'profile-setup') {
      replaceSessionRoute({ name: 'profile-setup' });
      return;
    }
    if (session.status === 'authenticated' && (authRoute || route.name === 'profile-setup')) {
      replaceSessionRoute({ name: 'home' });
      return;
    }
    if (session.status === 'guest' && guestProtectedRoute) {
      if (route.name === 'create') {
        pendingAuthRouteRef.current = route;
        setGuestAuthPromptOpen(true);
        replaceSessionRoute({ name: 'home' });
        return;
      }
      pendingAuthRouteRef.current = route;
      replaceSessionRoute({ name: 'welcome' });
      return;
    }
    initialSessionRouteResolvedRef.current = true;
  }, [navigate, route, session.status]);

  useMobileKeyboardViewport();

  const go = useCallback((next: AppRoute, replace = false) => {
    if (session.status === 'guest' && next.name === 'create') {
      pendingAuthRouteRef.current = next;
      setGuestAuthPromptOpen(true);
      return;
    }
    if (session.status === 'guest' && next.name === 'messages' && next.conversationId !== null) {
      pendingAuthRouteRef.current = next;
      setGuestAuthPromptOpen(true);
      return;
    }
    setLayer(null);
    const currentIndex = primaryRouteOrder[route.name];
    const nextIndex = primaryRouteOrder[next.name];
    const direction = !replace && currentIndex != null && nextIndex != null
      ? (nextIndex < currentIndex ? 'back' : 'forward')
      : undefined;
    navigate(next, { replace, direction });
  }, [navigate, route.name, session.status]);

  const goBack = useCallback((fallback?: AppRoute) => {
    setLayer(null);
    back(fallback);
  }, [back]);

  useEffect(() => {
    const listingId = route.name === 'listing' || route.name === 'booking' ? route.listingId : null;
    const listingTitle = listingId == null ? undefined : listings.find((item) => item.id === listingId)?.title;
    document.title = `${routeTitle(route, listingTitle)} — ВИГАЖ`;
  }, [route]);

  useLayoutEffect(() => {
    const restore = () => scrollTo(scrollRestoration.top, { immediate: true, force: true });
    restore();
    let settleFrame = 0;
    const restoreFrame = window.requestAnimationFrame(() => {
      restore();
      settleFrame = window.requestAnimationFrame(restore);
    });
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.cancelAnimationFrame(settleFrame);
    };
  }, [scrollRestoration, scrollTo]);

  const openRequests = useCallback((direction: RequestDirection) => {
    go({ name: 'requests', direction, requestId: null });
  }, [go]);

  const openListing = useCallback((listingId: number) => {
    go({ name: 'listing', listingId });
  }, [go]);

  const openChat = useCallback((conversationId: number) => {
    go({ name: 'messages', conversationId });
  }, [go]);

  const openBooking = useCallback((listingId: number, draft?: BookingDraft) => {
    setBookingDraft(draft);
    go({ name: 'booking', listingId });
  }, [go]);

  const requireBookingAuth = useCallback((listingId: number, draft: BookingDraft) => {
    setBookingDraft(draft);
    pendingAuthRouteRef.current = { name: 'booking', listingId };
    go({ name: 'auth-code', channel: 'phone', identifier: draft.phone ?? '' });
  }, [go]);

  const requireAuth = useCallback((target: AppRoute) => {
    pendingAuthRouteRef.current = target;
    setGuestAuthPromptOpen(false);
    setLayer(null);
    navigate({ name: 'welcome' });
  }, [navigate]);

  const cancelGuestAuth = useCallback(() => {
    pendingAuthRouteRef.current = null;
    setGuestAuthPromptOpen(false);
  }, []);

  const handleHomeNavigation = useCallback((target: HomeTab | 'create') => {
    if (target === 'search') {
      if (route.name === 'home') scrollTo('top', { duration: 0.7 });
      else go({ name: 'home' });
      return;
    }

    const routes: Record<Exclude<HomeTab | 'create', 'search'>, AppRoute> = {
      map: { name: 'map' },
      messages: { name: 'messages', conversationId: null },
      profile: { name: 'profile' },
      create: { name: 'create' },
    };
    go(routes[target]);
  }, [go, route.name, scrollTo]);

  const routePath = appRoutePath(route);
  const windowChromeHidden = useAppScrollChrome(routePath);
  const handleTabBarHiddenChange = useCallback((hidden: boolean) => {
    setReportedTabBar((current) => (
      current.route === routePath && current.hidden === hidden
        ? current
        : { route: routePath, hidden }
    ));
  }, [routePath]);

  const bottomTab = bottomNavigationTab(route);
  const reportedChromeHidden = reportedTabBar.route === routePath && reportedTabBar.hidden;
  const appChromeHidden = route.name === 'messages' && route.conversationId === null
    ? reportedChromeHidden
    : windowChromeHidden;
  useLayoutEffect(() => {
    document.documentElement.dataset.appChrome = appChromeHidden ? 'hidden' : 'visible';
    return () => { delete document.documentElement.dataset.appChrome; };
  }, [appChromeHidden]);
  const restoredHomeChromeHidden = route.name === 'home'
    && navigationDirection !== 'idle'
    && scrollRestoration.top > 12;
  const bottomTabHidden = bottomTab === null || restoredHomeChromeHidden || appChromeHidden;

  const page = (
    <PrimaryRouteFrame
      routeKey={appRoutePath(route)}
      navigationDirection={navigationDirection}
      activeTab={bottomTab}
      disabled={bottomTabHidden}
      onNavigate={handleHomeNavigation}
    >
      <AppRouteView
        route={route}
        search={search}
        bookingDraft={bookingDraft}
        initialScrollTop={scrollRestoration.top}
        catalogAlreadyShown={catalogAlreadyShownRef.current}
        setLayer={setLayer}
        navigate={go}
        back={goBack}
        openListing={openListing}
        openChat={openChat}
        openBooking={openBooking}
        openRequests={openRequests}
        onHomeNavigation={handleHomeNavigation}
        onToast={showMessage}
        onAuthComplete={() => {
          const target = pendingAuthRouteRef.current ?? { name: 'home' as const };
          pendingAuthRouteRef.current = null;
          go(target, true);
        }}
        onAuthCancelled={() => {
          pendingAuthRouteRef.current = null;
        }}
        onAuthRequired={requireAuth}
        onBookingAuthRequired={requireBookingAuth}
        onTabBarHiddenChange={handleTabBarHiddenChange}
      />
    </PrimaryRouteFrame>
  );

  const canSearch = route.name === 'home' || route.name === 'map';
  return (
    <>
      {page}
      {bottomTab !== null ? (
        <CustomTabBar
          active={bottomTab}
          hidden={bottomTabHidden}
          mapLayout={bottomTab === 'map'}
          onChange={(value) => {
            if (value === 'search' || value === 'map' || value === 'messages' || value === 'profile' || value === 'create') {
              handleHomeNavigation(value);
            }
          }}
        />
      ) : null}
      {canSearch ? (
        <AppSearchLayers
          layer={layer}
          search={search}
          onClose={() => setLayer(null)}
      />
      ) : null}
      <ConfirmationDialog
        open={Boolean(message)}
        onClose={clearMessage}
        title={visibleMessage || 'Действие выполнено'}
        icon={<Check size={22} />}
        tone="success"
        singleAction
        className="booking-success-dialog app-action-notice"
        actions={<Button size="sm" mode="solid" tone="primary" stretched startIcon={<Check size={18} />} onClick={clearMessage}>Понятно</Button>}
      />
      <Snackbar
        open={!message && performancePrompt.open}
        tone="neutral"
        onClose={performancePrompt.dismiss}
        action={<Button size="sm" mode="ghost" tone="neutral" className="performance-motion-action" onClick={performancePrompt.disableMotion}>Выключить</Button>}
      >Анимации снижают плавность интерфейса</Snackbar>
      <BottomSheet
        open={guestAuthPromptOpen}
        onClose={cancelGuestAuth}
        title="Войдите в аккаунт"
        desktopPresentation="modal"
        className="guest-auth-prompt"
        hideHeader
      >
        <div className="guest-auth-prompt__content">
          <span><LockKeyhole size={30} /></span>
          <SectionTitle>Войдите в аккаунт</SectionTitle>
          <BodyText as="p" color="secondary">Войдите или зарегистрируйтесь, чтобы размещать объявления, общаться и пользоваться всеми возможностями приложения «ВИГАЖ».</BodyText>
          <Button size="md" mode="solid" tone="primary" stretched className="guest-auth-prompt__primary" startIcon={<LogIn size={18} />} onClick={() => { setGuestAuthPromptOpen(false); setLayer(null); navigate({ name: 'welcome' }); }}>Войти или зарегистрироваться</Button>
          <Button size="md" mode="outline" tone="neutral" stretched className="guest-auth-prompt__cancel" onClick={cancelGuestAuth}>Отмена</Button>
        </div>
      </BottomSheet>
    </>
  );
}
