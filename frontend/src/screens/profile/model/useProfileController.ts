import { Bell, Building2, CalendarCheck2, Heart, Inbox, MessageSquareText } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent, type UIEvent } from 'react';
import { useNotificationsSnapshot } from '@features/notifications';
import { useMyListingsSnapshot } from '@features/my-listings';
import { isCurrentRequest, useRequestsSnapshot } from '@features/requests';
import { applyThemePreference, clearThemePreference, setThemePreference } from '@shared/lib/theme';
import { scrollToValidationAnchor } from '@shared/lib/forms/scrollToValidationError';
import {
  clearProfileStorage,
  createDefaultProfile,
  createDefaultSessions,
  loadProfile,
  loadSessions,
  normalizePhone,
  saveProfile as persistProfile,
  saveSessions,
  type ProfileData,
  type ProfileTheme,
  type SessionItem,
} from './profileStorage';
import { contactCodeLength, getTrustedContact, type ContactChannel } from './contactVerification';
import type { ContactTarget, ProfileActionGroup, ProfileDialog } from './profileViewTypes';

interface ProfileControllerOptions {
  onBookings: () => void;
  onFavorites: () => void;
  onIncoming: () => void;
  onMyListings: () => void;
  onReviews: () => void;
  onNotifications: () => void;
  onSignOut: () => void;
  onToast: (message: string) => void;
  onTabBarHiddenChange: (hidden: boolean) => void;
}

export function useProfileController({
  onBookings,
  onFavorites,
  onIncoming,
  onMyListings,
  onReviews,
  onNotifications,
  onSignOut,
  onToast,
  onTabBarHiddenChange,
}: ProfileControllerOptions) {
  const [profile, setProfile] = useState<ProfileData>(loadProfile);
  const [draft, setDraft] = useState<ProfileData>(profile);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'basic' | 'security'>('basic');
  const [settingsSwipeOffset, setSettingsSwipeOffset] = useState(0);
  const [settingsSwipeDragging, setSettingsSwipeDragging] = useState(false);
  const [settingsTabsHidden, setSettingsTabsHidden] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>(loadSessions);
  const [dialog, setDialog] = useState<ProfileDialog | null>(null);
  const [renderedDialog, setRenderedDialog] = useState<ProfileDialog>('contact-input');
  const visibleDialog = dialog ?? renderedDialog;
  const { unread: unreadNotifications } = useNotificationsSnapshot();
  const myListings = useMyListingsSnapshot();
  const { requests } = useRequestsSnapshot();
  const [dialogValue, setDialogValue] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [contactTarget, setContactTarget] = useState<ContactTarget>('email');
  const [verificationChannel, setVerificationChannel] = useState<ContactChannel>('email');
  const [verificationIdentifier, setVerificationIdentifier] = useState('');
  const [verificationSeconds, setVerificationSeconds] = useState(0);
  const [sessionDialog, setSessionDialog] = useState<'confirm' | 'success' | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [renderedSessionDialog, setRenderedSessionDialog] = useState<'confirm' | 'success'>('confirm');
  const [sessionTarget, setSessionTarget] = useState<{ id: string | null; label: string }>({ id: null, label: '' });
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [tabBarHidden, setTabBarHidden] = useState(false);
  const [desktopProfile, setDesktopProfile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches);
  const settingsSwipeRef = useRef<{ x: number; y: number } | null>(null);
  const settingsPanelNodesRef = useRef<Record<'basic' | 'security', HTMLDivElement | null>>({ basic: null, security: null });
  const settingsPanelScrollRef = useRef<Record<'basic' | 'security', number>>({ basic: 0, security: 0 });
  const settingsTabsHiddenRef = useRef(false);
  const settingsTabsTransitionUntilRef = useRef(0);
  const settingsScrollRef = useRef<Record<'basic' | 'security', { top: number; direction: 'up' | 'down' | null; travel: number }>>({
    basic: { top: 0, direction: null, travel: 0 },
    security: { top: 0, direction: null, travel: 0 },
  });
  const settingsOpenRef = useRef(false);
  const tabBarHiddenRef = useRef(false);
  const frozenTabBarHiddenRef = useRef(false);
  const lastProfileScrollRef = useRef(0);
  const lastProfileMaxScrollRef = useRef(0);
  const lastProfileViewportHeightRef = useRef(0);

  useLayoutEffect(() => {
    onTabBarHiddenChange(settingsOpen ? frozenTabBarHiddenRef.current : tabBarHidden);
  }, [onTabBarHiddenChange, settingsOpen, tabBarHidden]);

  useEffect(() => {
    applyThemePreference(profile.theme);
  }, [profile.theme]);

  useEffect(() => {
    if (dialog) setRenderedDialog(dialog);
  }, [dialog]);

  useEffect(() => {
    if (sessionDialog) setRenderedSessionDialog(sessionDialog);
  }, [sessionDialog]);

  useEffect(() => {
    if (verificationSeconds <= 0) return;
    const timer = window.setInterval(() => setVerificationSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [verificationSeconds]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 900px)');
    const syncDesktopProfile = () => setDesktopProfile(desktop.matches);
    const updateTabBar = (hidden: boolean) => {
      tabBarHiddenRef.current = hidden;
      setTabBarHidden(hidden);
    };
    const onScroll = () => {
      if (settingsOpenRef.current) return;
      if (desktop.matches) {
        updateTabBar(false);
        return;
      }
      const current = Math.max(0, window.scrollY);
      const viewportHeight = Math.max(1, window.visualViewport?.height ?? window.innerHeight);
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
      const delta = current - lastProfileScrollRef.current;
      const viewportChanged = lastProfileViewportHeightRef.current > 0
        && Math.abs(viewportHeight - lastProfileViewportHeightRef.current) > 1;
      const clampedAtBottom = delta < -10
        && lastProfileMaxScrollRef.current > 0
        && lastProfileScrollRef.current >= lastProfileMaxScrollRef.current - 3
        && current >= maxScroll - 3
        && maxScroll < lastProfileMaxScrollRef.current;
      if (viewportChanged || clampedAtBottom || document.documentElement.dataset.scrollLocked) {
        lastProfileScrollRef.current = current;
        lastProfileMaxScrollRef.current = maxScroll;
        lastProfileViewportHeightRef.current = viewportHeight;
        return;
      }
      if (current <= 12) updateTabBar(false);
      else if (delta > 10) updateTabBar(true);
      else if (delta < -10) updateTabBar(false);
      lastProfileScrollRef.current = current;
      lastProfileMaxScrollRef.current = maxScroll;
      lastProfileViewportHeightRef.current = viewportHeight;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    desktop.addEventListener('change', onScroll);
    desktop.addEventListener('change', syncDesktopProfile);
    syncDesktopProfile();
    if (!settingsOpenRef.current) onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      desktop.removeEventListener('change', onScroll);
      desktop.removeEventListener('change', syncDesktopProfile);
    };
  }, []);

  const completion = useMemo(() => {
    const source = settingsOpen ? draft : profile;
    const values = [source.avatar, source.phone, source.email];
    return Math.round(values.filter((value) => value.trim().length > 0).length / values.length * 100);
  }, [draft, profile, settingsOpen]);

  const deletionBlocked = useMemo(
    () => myListings.some((item) => item.status === 'active') || requests.some(isCurrentRequest),
    [myListings, requests],
  );

  const openSettings = (tab: 'basic' | 'security' = 'basic') => {
    setDraft(profile);
    setSettingsTab(tab);
    setError('');
    setAvatarError('');
    settingsPanelScrollRef.current = { basic: 0, security: 0 };
    settingsScrollRef.current = {
      basic: { top: 0, direction: null, travel: 0 },
      security: { top: 0, direction: null, travel: 0 },
    };
    settingsTabsHiddenRef.current = false;
    settingsTabsTransitionUntilRef.current = 0;
    setSettingsTabsHidden(false);
    frozenTabBarHiddenRef.current = tabBarHiddenRef.current;
    settingsOpenRef.current = true;
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    settingsOpenRef.current = false;
    setSettingsOpen(false);
  };

  useLayoutEffect(() => {
    if (!settingsOpen) return;
    const panel = settingsPanelNodesRef.current[settingsTab];
    if (!panel) return;
    panel.scrollTop = settingsPanelScrollRef.current[settingsTab];
    const hidden = panel.scrollTop > 8;
    settingsTabsHiddenRef.current = hidden;
    settingsTabsTransitionUntilRef.current = performance.now() + 300;
    setSettingsTabsHidden(hidden);
  }, [settingsOpen, settingsTab]);

  const handleSettingsScroll = (tab: 'basic' | 'security', event: UIEvent<HTMLDivElement>) => {
    if (desktopProfile) return;
    const current = Math.max(0, event.currentTarget.scrollTop);
    settingsPanelScrollRef.current[tab] = current;
    if (tab !== settingsTab) return;
    const state = settingsScrollRef.current[tab];
    const delta = current - state.top;
    const direction = delta > 0 ? 'down' : delta < 0 ? 'up' : state.direction;

    if (performance.now() < settingsTabsTransitionUntilRef.current) {
      state.top = current;
      state.direction = null;
      state.travel = 0;
      return;
    }

    const setTabsHidden = (hidden: boolean) => {
      if (settingsTabsHiddenRef.current === hidden) return;
      settingsTabsHiddenRef.current = hidden;
      settingsTabsTransitionUntilRef.current = performance.now() + 300;
      state.direction = null;
      state.travel = 0;
      setSettingsTabsHidden(hidden);
    };

    if (current <= 8) {
      state.direction = null;
      state.travel = 0;
      setTabsHidden(false);
    } else if (direction && Math.abs(delta) >= 1) {
      state.travel = state.direction === direction ? state.travel + Math.abs(delta) : Math.abs(delta);
      state.direction = direction;
      if (direction === 'down' && state.travel >= 18) setTabsHidden(true);
      if (direction === 'up' && state.travel >= 12) setTabsHidden(false);
    }
    state.top = current;
  };

  const changeSettingsTab = (next: 'basic' | 'security') => {
    if (next === settingsTab) return;
    setSettingsSwipeDragging(false);
    setSettingsSwipeOffset(0);
    setSettingsTab(next);
  };

  const startSettingsSwipe = (event: TouchEvent<HTMLDivElement>) => {
    if (desktopProfile || event.touches.length !== 1) return;
    const touch = event.touches[0];
    settingsSwipeRef.current = { x: touch.clientX, y: touch.clientY };
    setSettingsSwipeDragging(true);
    setSettingsSwipeOffset(0);
  };

  const moveSettingsSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = settingsSwipeRef.current;
    if (!start || desktopProfile || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const atEdge = (settingsTab === 'basic' && deltaX > 0) || (settingsTab === 'security' && deltaX < 0);
    const limit = Math.max(320, window.innerWidth);
    setSettingsSwipeOffset(Math.max(-limit, Math.min(limit, atEdge ? deltaX * .22 : deltaX)));
  };

  const finishSettingsSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = settingsSwipeRef.current;
    settingsSwipeRef.current = null;
    setSettingsSwipeDragging(false);
    if (!start || desktopProfile || event.changedTouches.length !== 1) {
      setSettingsSwipeOffset(0);
      return;
    }
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) >= 54 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      if (deltaX < 0 && settingsTab === 'basic') return changeSettingsTab('security');
      if (deltaX > 0 && settingsTab === 'security') return changeSettingsTab('basic');
    }
    setSettingsSwipeOffset(0);
  };

  const saveProfile = () => {
    if (draft.name.trim().length < 2) {
      setSettingsTab('basic');
      setError('Введите имя — минимум 2 символа.');
      scrollToValidationAnchor('profile-name-field');
      return;
    }
    const next = {
      ...draft,
      name: draft.name.trim(),
      surname: draft.surname.trim(),
      patronymic: draft.patronymic.trim(),
      city: draft.city.trim(),
    };
    setProfile(next);
    persistProfile(next);
    setThemePreference(next.theme);
    closeSettings();
    setError('');
  };

  const changeTheme = (theme: ProfileTheme, origin: { x: number; y: number }) => {
    if (theme === profile.theme) return;
    const next = { ...profile, theme };
    setProfile(next);
    setDraft((current) => ({ ...current, theme }));
    persistProfile(next);
    setThemePreference(theme, origin);
  };

  const updateProfileAvatar = (avatar: string) => {
    const next = { ...profile, avatar };
    setProfile(next);
    setDraft((current) => ({ ...current, avatar }));
    persistProfile(next);
    setAvatarError('');
  };

  const openContactDialog = (type: ContactTarget) => {
    const trusted = getTrustedContact(draft);
    setContactTarget(type);
    setDialogValue('');
    setPendingEmail('');
    setPendingPhone('');
    setVerificationSeconds(0);
    if (trusted) {
      setVerificationChannel(trusted.channel);
      setVerificationIdentifier(trusted.value);
      setDialog('contact-confirm');
    } else {
      setVerificationChannel(type);
      setVerificationIdentifier('');
      setDialog('contact-input');
    }
    setError('');
  };

  const beginAccountVerification = () => {
    setDialogValue('');
    setVerificationSeconds(60);
    setError('');
    setDialog('contact-verify');
  };

  const confirmAccountVerification = () => {
    if (dialogValue.length !== contactCodeLength(verificationChannel)) return;
    setDialogValue(contactTarget === 'phone' ? '+7 ' : '');
    setVerificationSeconds(0);
    setError('');
    setDialog('contact-input');
  };

  const resendVerificationCode = () => {
    setDialogValue('');
    setVerificationSeconds(60);
  };

  const useEmailVerificationFallback = () => {
    const email = draft.email.trim().toLowerCase();
    if (!email) return;
    setVerificationChannel('email');
    setVerificationIdentifier(email);
    setDialogValue('');
    setVerificationSeconds(60);
    setError('');
  };

  const closeContactDialog = () => {
    setDialog(null);
    setDialogValue('');
    setPendingEmail('');
    setPendingPhone('');
    setVerificationIdentifier('');
    setVerificationSeconds(0);
    setError('');
  };

  const beginNewContactVerification = () => {
    if (contactTarget === 'email') {
      const normalized = dialogValue.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalized)) {
        setError('Введите корректный email.');
        scrollToValidationAnchor('profile-contact-field');
        return;
      }
      if (normalized === draft.email.trim().toLowerCase()) {
        setError('Эта почта уже привязана к вашему аккаунту.');
        scrollToValidationAnchor('profile-contact-field');
        return;
      }
      setPendingEmail(normalized);
      setVerificationIdentifier(normalized);
      setVerificationChannel('email');
    } else {
      const formatted = normalizePhone(dialogValue);
      if (formatted.replace(/\D/g, '').length !== 11) {
        setError('Введите номер полностью.');
        scrollToValidationAnchor('profile-contact-field');
        return;
      }
      if (formatted === draft.phone) {
        setError('Этот номер телефона уже привязан к вашему аккаунту.');
        scrollToValidationAnchor('profile-contact-field');
        return;
      }
      setPendingPhone(formatted);
      setVerificationIdentifier(formatted);
      setVerificationChannel('phone');
    }
    setDialogValue('');
    setVerificationSeconds(60);
    setError('');
    setDialog('contact-new-verify');
  };

  const confirmNewContact = () => {
    if (dialogValue.length !== contactCodeLength(contactTarget)) return;
    if (contactTarget === 'email' && pendingEmail) setDraft((current) => ({ ...current, email: pendingEmail }));
    if (contactTarget === 'phone' && pendingPhone) setDraft((current) => ({ ...current, phone: pendingPhone }));
    closeContactDialog();
  };

  const requestRevokeSession = (session: SessionItem) => {
    setSessionTarget({ id: session.id, label: `${session.device} (${session.os})` });
    setSessionDialog('confirm');
  };

  const requestRevokeOtherSessions = () => {
    setSessionTarget({ id: null, label: 'всех остальных устройствах' });
    setSessionDialog('confirm');
  };

  const confirmSessionRevoke = () => {
    const next = sessionTarget.id
      ? sessions.filter((session) => session.id !== sessionTarget.id || session.current)
      : sessions.filter((session) => session.current);
    setSessions(next);
    saveSessions(next);
    setSessionDialog('success');
  };

  const copySupportAddress = async () => {
    const address = 'support@domryadom.ru';
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(address);
      else {
        const input = document.createElement('textarea');
        input.value = address;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('copy failed');
      }
      onToast('Адрес поддержки скопирован');
    } catch {
      onToast('Не удалось скопировать адрес');
    }
  };

  const deleteAccount = () => {
    clearProfileStorage();
    const nextProfile = createDefaultProfile();
    setProfile(nextProfile);
    setDraft(nextProfile);
    setSessions(createDefaultSessions());
    clearThemePreference();
    setDialog(null);
    closeSettings();
    onSignOut();
  };

  const openDeleteDialog = () => {
    setDialogValue('');
    setDialog(deletionBlocked ? 'delete-blocked' : 'delete');
  };

  const actionGroups: ProfileActionGroup[] = [
    {
      title: 'Аккаунт',
      items: [
        { title: 'Избранное', subtitle: 'Сохранённые объявления', icon: Heart, onClick: onFavorites },
        { title: 'Уведомления', subtitle: 'Заявки, объявления, сообщения и отзывы', icon: Bell, count: unreadNotifications, onClick: onNotifications },
      ],
    },
    {
      title: 'Аренда',
      items: [
        { title: 'Мои объявления', subtitle: 'Объекты, цены, доступность и продвижение', icon: Building2, count: myListings.length, onClick: onMyListings },
        { title: 'Мои брони', subtitle: 'Ваши заявки и подтверждённые бронирования', icon: CalendarCheck2, onClick: onBookings },
        { title: 'Входящие заявки', subtitle: 'Запросы гостей на бронирование жилья', icon: Inbox, count: 1, onClick: onIncoming },
        { title: 'Мои отзывы', subtitle: 'Оставленные и полученные отзывы', icon: MessageSquareText, onClick: onReviews },
      ],
    },
  ];

  const contactDialogOpen = Boolean(dialog && dialog !== 'delete' && dialog !== 'delete-blocked');


  const cancelSettingsSwipe = () => {
    settingsSwipeRef.current = null;
    setSettingsSwipeDragging(false);
    setSettingsSwipeOffset(0);
  };
  const discardDraft = () => {
    setDraft(profile);
    closeSettings();
  };
  const patchDraft = (patch: Partial<ProfileData>) => {
    setDraft((current) => ({ ...current, ...patch }));
    if ('avatar' in patch) setAvatarError('');
  };
  const clearNameError = () => {
    if (error === 'Введите имя — минимум 2 символа.') setError('');
  };
  const applyBirthday = (birthday: string) => {
    setDraft((current) => ({ ...current, birthday }));
    setBirthdayPickerOpen(false);
    setError('');
  };
  const selectCity = (city: string | null) => {
    if (!city) return;
    setDraft((current) => ({ ...current, city }));
    setCityPickerOpen(false);
    setError('');
  };
  const signOut = () => {
    setSignOutOpen(false);
    onSignOut();
  };

  return {
    profile,
    draft,
    settingsOpen,
    birthdayPickerOpen,
    setBirthdayPickerOpen,
    cityPickerOpen,
    setCityPickerOpen,
    settingsTab,
    settingsSwipeOffset,
    settingsSwipeDragging,
    settingsTabsHidden,
    sessions,
    dialog,
    visibleDialog,
    renderedSessionDialog,
    dialogValue,
    setDialogValue,
    contactTarget,
    verificationChannel,
    verificationIdentifier,
    verificationSeconds,
    sessionDialog,
    setSessionDialog,
    signOutOpen,
    setSignOutOpen,
    sessionTarget,
    error,
    setError,
    avatarError,
    setAvatarError,
    desktopProfile,
    settingsPanelNodesRef,
    completion,
    myListings,
    actionGroups,
    contactDialogOpen,
    openSettings,
    closeSettings,
    handleSettingsScroll,
    changeSettingsTab,
    startSettingsSwipe,
    moveSettingsSwipe,
    finishSettingsSwipe,
    cancelSettingsSwipe,
    saveProfile,
    changeTheme,
    updateProfileAvatar,
    openContactDialog,
    beginAccountVerification,
    confirmAccountVerification,
    confirmNewContact,
    closeContactDialog,
    beginNewContactVerification,
    resendVerificationCode,
    useEmailVerificationFallback,
    requestRevokeSession,
    requestRevokeOtherSessions,
    confirmSessionRevoke,
    copySupportAddress,
    deleteAccount,
    openDeleteDialog,
    discardDraft,
    patchDraft,
    clearNameError,
    applyBirthday,
    selectCity,
    signOut,
  };
}

export type ProfileController = ReturnType<typeof useProfileController>;

