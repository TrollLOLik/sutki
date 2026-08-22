import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { filterListingCollection } from '@features/listing-search';
import { myListingsRepository, useMyListingsSnapshot, type OwnerListing } from '@features/my-listings';
import type { ListingLayoutMode } from '@entities/listing';
import { usePullToRefresh } from '@shared/lib/scroll/usePullToRefresh';
import { useWindowTabPanelScroll } from '@shared/lib/scroll/useWindowTabPanelScroll';
import { countActiveFilters, defaultFilters as catalogDefaultFilters, type SearchFilters } from '@shared/types/filters';
import {
  myListingsTabScrollPositions,
  quickStatuses,
  sameStatuses,
  statusesForTab,
  type MyListingsFilterStatus,
  type MyListingsTab,
} from './myListingsView';

interface MyListingsPageControllerOptions {
  initialTab: MyListingsTab;
  favoriteIds: ReadonlySet<number>;
  onToast: (message: string) => void;
}

export function useMyListingsPageController({ initialTab, favoriteIds, onToast }: MyListingsPageControllerOptions) {
  const allItems = useMyListingsSnapshot();
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<ListingLayoutMode>('list');
  const [filters, setFilters] = useState<SearchFilters>(catalogDefaultFilters);
  const [statuses, setStatuses] = useState<MyListingsFilterStatus[]>(() => statusesForTab(initialTab));
  const [draftStatuses, setDraftStatuses] = useState<MyListingsFilterStatus[]>(() => statusesForTab(initialTab));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [unpublishItem, setUnpublishItem] = useState<OwnerListing | null>(null);
  const [publishItem, setPublishItem] = useState<OwnerListing | null>(null);
  const [publicationError, setPublicationError] = useState(false);
  const [tabSwipeOffset, setTabSwipeOffset] = useState(0);
  const [tabSwipeDragging, setTabSwipeDragging] = useState(false);
  const tabTouchStart = useRef<{ x: number; y: number } | null>(null);
  const resultTimerRef = useRef<number | null>(null);
  const pullToRefresh = usePullToRefresh();

  useEffect(() => () => {
    if (resultTimerRef.current !== null) window.clearTimeout(resultTimerRef.current);
  }, []);

  const showResultAfterDialog = (message: string) => {
    if (resultTimerRef.current !== null) window.clearTimeout(resultTimerRef.current);
    resultTimerRef.current = window.setTimeout(() => {
      resultTimerRef.current = null;
      onToast(message);
    }, 440);
  };

  const filteredItems = useMemo(() => {
    const byId = new Map(allItems.map((item) => [item.listing.id, item]));
    return filterListingCollection(
      allItems.map((item) => item.listing),
      filters,
      query,
      new Set(favoriteIds),
      { ignoreOwnership: true },
    ).flatMap((listing) => {
      const item = byId.get(listing.id);
      return item ? [item] : [];
    });
  }, [allItems, favoriteIds, filters, query]);
  const items = useMemo(() => filteredItems.filter((item) => statuses.length === 0 || statuses.includes(item.status)), [filteredItems, statuses]);
  const activeQuickTab: MyListingsTab | 'custom' = quickStatuses.find((item) => sameStatuses(item.statuses, statuses))?.value ?? 'custom';
  const activeQuickIndex = activeQuickTab === 'custom' ? -1 : quickStatuses.findIndex((item) => item.value === activeQuickTab);
  const tabPanels = quickStatuses.map((panel) => ({
    tab: panel.value,
    items: filteredItems.filter((item) => panel.statuses.length === 0 || panel.statuses.includes(item.status)),
  }));
  const counts = (values: readonly MyListingsFilterStatus[]) => values.length === 0
    ? allItems.length
    : allItems.filter((item) => values.includes(item.status)).length;
  const tabs = quickStatuses.map((item) => ({ ...item, count: counts(item.statuses) }));
  const activeFilterCount = countActiveFilters(filters) + statuses.length;
  const tabScroll = useWindowTabPanelScroll(activeQuickTab, myListingsTabScrollPositions);

  const openFilters = () => {
    setDraftStatuses(statuses);
    setFiltersOpen(true);
  };
  const selectQuickStatus = (value: MyListingsTab) => {
    tabScroll.capture();
    const nextStatuses = statusesForTab(value);
    setTabSwipeDragging(false);
    setTabSwipeOffset(0);
    setStatuses(nextStatuses);
    setDraftStatuses(nextStatuses);
  };
  const startTabSwipe = (event: TouchEvent<HTMLDivElement>) => {
    if (activeQuickIndex < 0 || window.matchMedia('(min-width: 900px)').matches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    tabTouchStart.current = { x: touch.clientX, y: touch.clientY };
    setTabSwipeDragging(true);
    setTabSwipeOffset(0);
  };
  const moveTabSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = tabTouchStart.current;
    if (!start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const atEdge = (activeQuickIndex === 0 && deltaX > 0) || (activeQuickIndex === quickStatuses.length - 1 && deltaX < 0);
    const limit = Math.max(320, window.innerWidth);
    setTabSwipeOffset(Math.max(-limit, Math.min(limit, atEdge ? deltaX * .22 : deltaX)));
  };
  const finishTabSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = tabTouchStart.current;
    tabTouchStart.current = null;
    setTabSwipeDragging(false);
    const touch = event.changedTouches[0];
    if (!start || !touch || activeQuickIndex < 0) {
      setTabSwipeOffset(0);
      return;
    }
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) >= 54 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      const next = quickStatuses[deltaX < 0 ? activeQuickIndex + 1 : activeQuickIndex - 1];
      if (next) return selectQuickStatus(next.value);
    }
    setTabSwipeOffset(0);
  };
  const cancelTabSwipe = () => {
    tabTouchStart.current = null;
    setTabSwipeDragging(false);
    setTabSwipeOffset(0);
  };
  const confirmUnpublish = () => {
    if (!unpublishItem) return;
    myListingsRepository.setPublication(unpublishItem.listing.id, false);
    setUnpublishItem(null);
    showResultAfterDialog('Объявление снято с публикации');
  };
  const confirmPublish = () => {
    if (!publishItem) return;
    try {
      myListingsRepository.setPublication(publishItem.listing.id, true);
      setPublishItem(null);
      showResultAfterDialog('Объявление отправлено на проверку');
    } catch {
      setPublishItem(null);
      setPublicationError(true);
    }
  };
  const applyFilters = (nextFilters: SearchFilters) => {
    tabScroll.capture();
    setFilters(nextFilters);
    setStatuses(draftStatuses);
    setFiltersOpen(false);
  };
  const getResultCount = (nextFilters: SearchFilters) => filterListingCollection(
    allItems.map((item) => item.listing),
    nextFilters,
    query,
    new Set(favoriteIds),
    { ignoreOwnership: true },
  ).filter((listing) => {
    const item = allItems.find((candidate) => candidate.listing.id === listing.id);
    return Boolean(item && (draftStatuses.length === 0 || draftStatuses.includes(item.status)));
  }).length;

  return {
    allItems,
    query,
    setQuery,
    layout,
    setLayout,
    filters,
    draftStatuses,
    setDraftStatuses,
    filtersOpen,
    setFiltersOpen,
    unpublishItem,
    setUnpublishItem,
    publishItem,
    setPublishItem,
    publicationError,
    setPublicationError,
    pullToRefresh,
    items,
    activeQuickTab,
    activeQuickIndex,
    tabPanels,
    tabs,
    activeFilterCount,
    tabScroll,
    tabSwipeOffset,
    tabSwipeDragging,
    openFilters,
    selectQuickStatus,
    startTabSwipe,
    moveTabSwipe,
    finishTabSwipe,
    cancelTabSwipe,
    confirmUnpublish,
    confirmPublish,
    applyFilters,
    getResultCount,
  };
}
