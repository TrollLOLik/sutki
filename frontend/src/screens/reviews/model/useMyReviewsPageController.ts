import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { filterAndSortReviews, reviewRepository, useReviewsSnapshot, type Review, type ReviewSort } from '@features/reviews';
import { usePullToRefresh } from '@shared/lib/scroll/usePullToRefresh';
import { useWindowTabPanelScroll } from '@shared/lib/scroll/useWindowTabPanelScroll';

export type ReviewsTab = 'written' | 'received';

const reviewsListViewState: { scrollY: Record<ReviewsTab, number>; tab: ReviewsTab } = {
  scrollY: { written: 0, received: 0 },
  tab: 'written',
};

interface MyReviewsPageControllerOptions {
  initialTab?: ReviewsTab;
  focusReviewId?: number;
  onToast: (message: string) => void;
}

export function useMyReviewsPageController({ initialTab, focusReviewId, onToast }: MyReviewsPageControllerOptions) {
  const { reviews } = useReviewsSnapshot();
  const [tab, setTab] = useState<ReviewsTab>(() => initialTab ?? reviewsListViewState.tab);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [deleteReview, setDeleteReview] = useState<Review | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [tabSwipeOffset, setTabSwipeOffset] = useState(0);
  const [tabSwipeDragging, setTabSwipeDragging] = useState(false);
  const tabTouchStart = useRef<{ x: number; y: number } | null>(null);
  const pullToRefresh = usePullToRefresh();
  const tabScroll = useWindowTabPanelScroll(tab, reviewsListViewState.scrollY);

  const written = useMemo(() => filterAndSortReviews(reviews.filter((review) => review.writtenByMe), query, sort), [query, reviews, sort]);
  const received = useMemo(() => filterAndSortReviews(reviews.filter((review) => review.receivedByMe), query, sort), [query, reviews, sort]);
  const writtenCount = reviews.filter((review) => review.writtenByMe).length;
  const receivedCount = reviews.filter((review) => review.receivedByMe).length;
  const tabPanels: Array<{ tab: ReviewsTab; rawCount: number; items: Review[] }> = [
    { tab: 'written', rawCount: writtenCount, items: written },
    { tab: 'received', rawCount: receivedCount, items: received },
  ];

  useEffect(() => {
    if (initialTab) reviewsListViewState.tab = initialTab;
  }, [initialTab]);

  useEffect(() => {
    if (!focusReviewId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`review-${focusReviewId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusReviewId, tab, written, received]);

  const changeTab = (next: ReviewsTab) => {
    if (next === tab) return;
    tabScroll.capture();
    setTabSwipeDragging(false);
    setTabSwipeOffset(0);
    setTab(next);
    reviewsListViewState.tab = next;
  };
  const startTabSwipe = (event: TouchEvent<HTMLDivElement>) => {
    if (window.matchMedia('(min-width: 900px)').matches || event.touches.length !== 1) return;
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
    const atEdge = (tab === 'written' && deltaX > 0) || (tab === 'received' && deltaX < 0);
    const limit = Math.max(320, window.innerWidth);
    setTabSwipeOffset(Math.max(-limit, Math.min(limit, atEdge ? deltaX * 0.22 : deltaX)));
  };
  const finishTabSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = tabTouchStart.current;
    tabTouchStart.current = null;
    setTabSwipeDragging(false);
    const touch = event.changedTouches[0];
    if (!start || !touch) { setTabSwipeOffset(0); return; }
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) >= 54 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      if (deltaX < 0 && tab === 'written') return changeTab('received');
      if (deltaX > 0 && tab === 'received') return changeTab('written');
    }
    setTabSwipeOffset(0);
  };
  const cancelTabSwipe = () => {
    tabTouchStart.current = null;
    setTabSwipeDragging(false);
    setTabSwipeOffset(0);
  };
  const confirmDelete = async () => {
    if (!deleteReview || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await reviewRepository.delete(deleteReview.id);
      setDeleteReview(null);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Не удалось удалить отзыв');
    } finally {
      setDeleteBusy(false);
    }
  };
  const closeDeleteDialog = () => {
    if (!deleteBusy) setDeleteReview(null);
  };

  return {
    tab,
    query,
    setQuery,
    sort,
    setSort,
    sortOpen,
    setSortOpen,
    deleteReview,
    setDeleteReview,
    deleteBusy,
    pullToRefresh,
    tabScroll,
    writtenCount,
    receivedCount,
    tabPanels,
    tabSwipeOffset,
    tabSwipeDragging,
    changeTab,
    startTabSwipe,
    moveTabSwipe,
    finishTabSwipe,
    cancelTabSwipe,
    confirmDelete,
    closeDeleteDialog,
  };
}
