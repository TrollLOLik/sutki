import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListingLayoutMode } from '@entities/listing';
import { useChatSnapshot } from '@features/chat';
import { filterListingCollection } from '@features/listing-search';
import { listings } from '@shared/data/listings';
import { countActiveFilters, defaultFilters, type SearchFilters } from '@shared/types/filters';

interface PublicProfileControllerOptions {
  userId: string;
  favorites: ReadonlySet<number>;
  onToast: (message: string) => void;
}

export function usePublicProfileController({ userId, favorites, onToast }: PublicProfileControllerOptions) {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [stickyActionsVisible, setStickyActionsVisible] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const [catalogLayer, setCatalogLayer] = useState<null | 'search' | 'filters'>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogFilters, setCatalogFilters] = useState<SearchFilters>(defaultFilters);
  const [catalogLayout, setCatalogLayout] = useState<ListingLayoutMode>('list');
  const { conversations } = useChatSnapshot();
  const conversation = conversations.find((item) => item.otherUser.id === userId);
  const ownerListings = useMemo(() => listings.filter((item) => item.owner?.id === userId), [userId]);
  const visibleOwnerListings = useMemo(() => filterListingCollection(ownerListings, catalogFilters, catalogQuery, new Set(favorites), { ignoreOwnership: true }), [catalogFilters, catalogQuery, ownerListings, favorites]);
  const user = ownerListings[0]?.owner ?? conversation?.otherUser;
  const searchLabel = catalogFilters.city ?? catalogQuery;
  const activeFilters = countActiveFilters(catalogFilters);
  const hasCatalogConstraints = activeFilters > 0 || catalogQuery.trim().length > 0;
  const countOwnerListings = useCallback((draft: SearchFilters) => filterListingCollection(ownerListings, draft, catalogQuery, new Set(favorites), { ignoreOwnership: true }).length, [catalogQuery, ownerListings, favorites]);
  const toggleCatalogLayout = () => setCatalogLayout((current) => {
    const next = current === 'list' ? 'grid' : 'list';
    try { window.localStorage.setItem('public-profile-catalog-layout', next); } catch { /* Keep the in-memory choice. */ }
    return next;
  });
  const resetCatalog = () => {
    setCatalogQuery('');
    setCatalogFilters(defaultFilters);
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('public-profile-catalog-layout');
      if (saved === 'list' || saved === 'grid') setCatalogLayout(saved);
    } catch {
      // Storage can be unavailable in private or embedded contexts.
    }
  }, []);

  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setStickyActionsVisible(!entry.isIntersecting && entry.boundingClientRect.bottom <= 72), { threshold: 0 });
    observer.observe(actions);
    return () => observer.disconnect();
  }, [user?.id]);

  const shareProfile = async () => {
    const title = user ? ['Профиль', user.surname, user.name].filter(Boolean).join(' ') : 'Профиль пользователя';
    const data = { title, text: title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(window.location.href);
        onToast('Ссылка на профиль скопирована');
      }
    } catch {
      // Closing the system dialog and share failures do not require a separate message.
    }
  };

  return {
    avatarOpen,
    setAvatarOpen,
    stickyActionsVisible,
    actionsRef,
    catalogLayer,
    setCatalogLayer,
    catalogQuery,
    setCatalogQuery,
    catalogFilters,
    setCatalogFilters,
    catalogLayout,
    conversation,
    ownerListings,
    visibleOwnerListings,
    user,
    searchLabel,
    activeFilters,
    hasCatalogConstraints,
    countOwnerListings,
    toggleCatalogLayout,
    resetCatalog,
    shareProfile,
  };
}

export type PublicProfileController = ReturnType<typeof usePublicProfileController>;
