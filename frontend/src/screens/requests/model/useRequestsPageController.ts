import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import {
  filterAndSortRequests,
  isCurrentRequest,
  requestRepository,
  useRequestsSnapshot,
  type RentalRequest,
  type RequestDialogState,
  type RequestDirection,
  type RequestSort,
  type RequestTab,
} from '@features/requests';
import { usePullToRefresh } from '@shared/lib/scroll/usePullToRefresh';
import { useWindowTabPanelScroll } from '@shared/lib/scroll/useWindowTabPanelScroll';

const requestListViewState: Record<RequestDirection, { scrollY: Record<RequestTab, number>; tab: RequestTab }> = {
  incoming: { scrollY: { current: 0, history: 0 }, tab: 'current' },
  outgoing: { scrollY: { current: 0, history: 0 }, tab: 'current' },
};

interface RequestsPageControllerOptions {
  mode: RequestDirection;
  requestId: number | null;
  onToast: (message: string) => void;
  onOpenRequest: (mode: RequestDirection, id: number) => void;
}

export function useRequestsPageController({ mode, requestId, onToast, onOpenRequest }: RequestsPageControllerOptions) {
  const snapshot = useRequestsSnapshot();
  const [tab, setTab] = useState<RequestTab>(() => requestListViewState[mode].tab);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RequestSort>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [dialog, setDialog] = useState<RequestDialogState>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tabSwipeOffset, setTabSwipeOffset] = useState(0);
  const [tabSwipeDragging, setTabSwipeDragging] = useState(false);
  const tabTouchStart = useRef<{ x: number; y: number } | null>(null);

  const modeRequests = useMemo(() => snapshot.requests.filter((request) => request.direction === mode), [mode, snapshot.requests]);
  const currentItems = useMemo(() => filterAndSortRequests(modeRequests.filter(isCurrentRequest), query, sort), [modeRequests, query, sort]);
  const historyItems = useMemo(() => filterAndSortRequests(modeRequests.filter((request) => !isCurrentRequest(request)), query, sort), [modeRequests, query, sort]);
  const selectedRequest = requestId == null ? null : modeRequests.find((item) => item.id === requestId) ?? null;
  const pullToRefresh = usePullToRefresh({
    disabled: selectedRequest != null,
    onRefresh: requestRepository.refresh,
    onRefreshError: (error) => onToast(error instanceof Error ? error.message : 'Не удалось обновить заявки'),
  });
  const tabScroll = useWindowTabPanelScroll(tab, requestListViewState[mode].scrollY, selectedRequest != null);

  useEffect(() => {
    if (selectedRequest) setTab(isCurrentRequest(selectedRequest) ? 'current' : 'history');
  }, [selectedRequest]);

  useLayoutEffect(() => {
    if (selectedRequest) return;
    setTab(requestListViewState[mode].tab);
  }, [mode, selectedRequest]);

  const runAction = async (action: () => Promise<void>) => {
    const id = dialog?.request.id ?? null;
    setBusyId(id);
    try {
      await action();
      setDialog(null);
      setReason('');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Не удалось выполнить действие');
    } finally {
      setBusyId(null);
    }
  };
  const confirmRequest = (request: RentalRequest) => setDialog({ type: 'confirm', request });
  const rejectRequest = (request: RentalRequest) => { setReason(''); setDialog({ type: 'reject', request }); };
  const cancelRequest = (request: RentalRequest) => { setReason(''); setDialog({ type: 'cancel', request }); };
  const openRequest = (id: number) => {
    tabScroll.capture();
    requestListViewState[mode].tab = tab;
    onOpenRequest(mode, id);
  };
  const changeTab = (next: RequestTab) => {
    if (next === tab) return;
    tabScroll.capture();
    setTabSwipeDragging(false);
    setTabSwipeOffset(0);
    setTab(next);
    requestListViewState[mode].tab = next;
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
    const atEdge = (tab === 'current' && deltaX > 0) || (tab === 'history' && deltaX < 0);
    const limit = Math.max(320, window.innerWidth);
    setTabSwipeOffset(Math.max(-limit, Math.min(limit, atEdge ? deltaX * .22 : deltaX)));
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
      if (deltaX < 0 && tab === 'current') return changeTab('history');
      if (deltaX > 0 && tab === 'history') return changeTab('current');
    }
    setTabSwipeOffset(0);
  };
  const cancelTabSwipe = () => {
    tabTouchStart.current = null;
    setTabSwipeDragging(false);
    setTabSwipeOffset(0);
  };
  const closeDialog = () => {
    if (busyId != null) return;
    setDialog(null);
    setReason('');
  };
  const submitDialog = () => {
    if (!dialog) return;
    if (dialog.type === 'confirm') void runAction(() => requestRepository.confirmIncoming(dialog.request.id));
    if (dialog.type === 'reject') void runAction(() => requestRepository.rejectIncoming(dialog.request.id, reason));
    if (dialog.type === 'cancel') void runAction(() => requestRepository.cancelOutgoing(dialog.request.id, reason));
  };

  const currentCount = modeRequests.filter(isCurrentRequest).length;
  const tabPanels: Array<{ tab: RequestTab; items: RentalRequest[] }> = [
    { tab: 'current', items: currentItems },
    { tab: 'history', items: historyItems },
  ];

  return {
    tab,
    query,
    setQuery,
    sort,
    setSort,
    sortOpen,
    setSortOpen,
    dialog,
    reason,
    setReason,
    busyId,
    selectedRequest,
    pullToRefresh,
    tabScroll,
    currentCount,
    historyCount: modeRequests.length - currentCount,
    tabPanels,
    tabSwipeOffset,
    tabSwipeDragging,
    confirmRequest,
    rejectRequest,
    cancelRequest,
    openRequest,
    changeTab,
    startTabSwipe,
    moveTabSwipe,
    finishTabSwipe,
    cancelTabSwipe,
    closeDialog,
    submitDialog,
  };
}
