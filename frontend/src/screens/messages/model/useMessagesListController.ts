import { useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent as ReactUIEvent } from 'react';
import { chatRepository, useChatSnapshot, type ConversationSort } from '@features/chat';
import { usePullToRefresh } from '@shared/lib/scroll/usePullToRefresh';
import { latestMessage, latestMessagePreview, timestampOf } from './formatters';
import type { ConversationTab } from '../ui/ConversationSidebar';

const messagesListViewState = { scrollTop: 0, chromeHidden: false };

interface MessagesListControllerOptions {
  activeConversationId: number | null;
  onTabBarHiddenChange: (hidden: boolean) => void;
  onToast: (message: string) => void;
}

export function useMessagesListController({ activeConversationId, onTabBarHiddenChange, onToast }: MessagesListControllerOptions) {
  const { conversations } = useChatSnapshot();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ConversationTab>('all');
  const [sort, setSort] = useState<ConversationSort>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [listChromeHidden, setListChromeHidden] = useState(() => messagesListViewState.chromeHidden);
  const conversationListRef = useRef<HTMLDivElement>(null);
  const listScrollTopRef = useRef(0);
  const listScrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const listScrollTravelRef = useRef(0);
  const chromeTransitionUntilRef = useRef(0);
  const pullToRefresh = usePullToRefresh({
    scrollRef: conversationListRef,
    disabled: activeConversationId != null,
    onRefresh: chatRepository.refresh,
    onRefreshError: (error) => onToast(error instanceof Error ? error.message : 'Не удалось обновить сообщения'),
  });

  useLayoutEffect(() => {
    if (activeConversationId != null || !conversationListRef.current) return;
    conversationListRef.current.scrollTop = messagesListViewState.scrollTop;
    listScrollTopRef.current = messagesListViewState.scrollTop;
  }, [activeConversationId]);
  useEffect(() => { messagesListViewState.chromeHidden = listChromeHidden; }, [listChromeHidden]);
  useLayoutEffect(() => { onTabBarHiddenChange(activeConversationId == null && listChromeHidden); }, [activeConversationId, listChromeHidden, onTabBarHiddenChange]);

  const availableConversations = useMemo(() => conversations.filter((conversation) => !conversation.archived), [conversations]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    const result = availableConversations.filter((conversation) => {
      const last = latestMessage(conversation);
      if (filter === 'renting' && conversation.isOwner) return false;
      if (filter === 'hosting' && !conversation.isOwner) return false;
      if (!normalized) return true;
      const haystack = [conversation.otherUser.name, conversation.otherUser.surname, conversation.listing?.address, conversation.listing?.title, latestMessagePreview(last)].filter(Boolean).join(' ').toLocaleLowerCase('ru');
      return haystack.includes(normalized);
    });
    return result.sort((a, b) => {
      if (sort === 'unread') {
        const unread = b.unreadCount - a.unreadCount;
        if (unread !== 0) return unread;
      }
      const difference = timestampOf(b) - timestampOf(a);
      return sort === 'oldest' ? -difference : difference;
    });
  }, [availableConversations, filter, query, sort]);

  const resolvedConversationId = activeConversationId ?? filtered[0]?.id ?? availableConversations[0]?.id ?? null;
  const activeConversation = conversations.find((item) => item.id === resolvedConversationId) ?? null;
  const emptyTitle = query.trim() ? 'Ничего не найдено' : filter === 'hosting' ? 'Чатов по вашим объявлениям пока нет' : filter === 'renting' ? 'Чатов с владельцами пока нет' : 'Сообщений пока нет';
  const emptySubtitle = query.trim() ? 'Попробуйте изменить запрос или имя собеседника.' : filter === 'hosting' ? 'Здесь появятся переписки с гостями по вашим объявлениям.' : filter === 'renting' ? 'Здесь появятся переписки по объявлениям, которые вы рассматриваете.' : 'Здесь появятся ваши переписки по объявлениям и заявкам.';

  const handleConversationListScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    const y = Math.max(0, event.currentTarget.scrollTop);
    messagesListViewState.scrollTop = y;
    if (Date.now() < chromeTransitionUntilRef.current) { listScrollTopRef.current = y; return; }
    const delta = y - listScrollTopRef.current;
    if (y <= 8) {
      setListChromeHidden(false);
      listScrollDirectionRef.current = null;
      listScrollTravelRef.current = 0;
    } else if (Math.abs(delta) >= 1) {
      const direction = delta > 0 ? 'down' : 'up';
      if (listScrollDirectionRef.current !== direction) { listScrollDirectionRef.current = direction; listScrollTravelRef.current = 0; }
      listScrollTravelRef.current += Math.abs(delta);
      const threshold = direction === 'down' ? 24 : 8;
      if (listScrollTravelRef.current >= threshold) {
        const hidden = direction === 'down';
        setListChromeHidden(hidden);
        if (hidden) setSortOpen(false);
        chromeTransitionUntilRef.current = Date.now() + 320;
        listScrollTravelRef.current = 0;
      }
    }
    listScrollTopRef.current = y;
  };
  const selectFilter = (nextFilter: ConversationTab) => {
    if (filter === nextFilter) return;
    setFilter(nextFilter);
    setListChromeHidden(false);
  };

  return { query, setQuery, filter, sort, setSort, sortOpen, setSortOpen, listChromeHidden, conversationListRef, pullToRefresh, availableConversations, filtered, resolvedConversationId, activeConversation, emptyTitle, emptySubtitle, handleConversationListScroll, selectFilter };
}
