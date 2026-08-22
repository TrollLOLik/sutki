import { MessageCircle } from 'lucide-react';
import { DesktopTopbar } from '@widgets/app-navigation';
import { DescriptionText, PullToRefreshIndicator, SectionTitle } from '@ui';
import { CHAT_DATA_MODE } from '@features/chat';
import { useMessagesListController } from '../model/useMessagesListController';
import { ChatDialog } from './ChatDialog';
import { ConversationSidebar } from './ConversationSidebar';
import '../messages.css';

interface MessagesPageProps {
  activeConversationId: number | null;
  onOpenConversation: (conversationId: number) => void;
  onBackToList: () => void;
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onProfile: () => void;
  onOpenListing: (listingId: number) => void;
  onOpenProfile: (userId: string) => void;
  onOpenRequest: (requestId: number, direction: 'incoming' | 'outgoing') => void;
  onToast: (message: string) => void;
  onTabBarHiddenChange: (hidden: boolean) => void;
}

export function MessagesPage({
  activeConversationId,
  onOpenConversation,
  onBackToList,
  onHome,
  onCreate,
  onMap,
  onProfile,
  onOpenListing,
  onOpenProfile,
  onOpenRequest,
  onToast,
  onTabBarHiddenChange,
}: MessagesPageProps) {
  const controller = useMessagesListController({ activeConversationId, onTabBarHiddenChange, onToast });
  const { query, setQuery, filter, sort, setSort, sortOpen, setSortOpen, listChromeHidden, conversationListRef, pullToRefresh, availableConversations, filtered, resolvedConversationId, activeConversation, emptyTitle, emptySubtitle, handleConversationListScroll, selectFilter } = controller;
  return (
    <div className={`chat-page ${activeConversationId != null ? 'mobile-thread-open' : ''}`}>
      <PullToRefreshIndicator {...pullToRefresh} refreshingLabel="Обновление сообщений" />
      <DesktopTopbar
        active="messages"
        onSearch={onHome}
        onMap={onMap}
        onMessages={() => undefined}
        onProfile={onProfile}
        onCreate={onCreate}
      />

      <main className="chat-workspace">
        <ConversationSidebar
          hidden={listChromeHidden}
          conversations={availableConversations}
          filtered={filtered}
          selectedConversationId={resolvedConversationId}
          query={query}
          sort={sort}
          sortOpen={sortOpen}
          filter={filter}
          emptyTitle={emptyTitle}
          emptySubtitle={emptySubtitle}
          scrollRef={conversationListRef}
          onScroll={handleConversationListScroll}
          onQueryChange={setQuery}
          onSortChange={setSort}
          onSortOpenChange={setSortOpen}
          onFilterChange={selectFilter}
          onOpenConversation={onOpenConversation}
        />

        <section className="chat-dialog-shell" aria-label="Диалог">
          {activeConversation ? (
            <ChatDialog
              key={activeConversation.id}
              conversation={activeConversation}
              onBack={onBackToList}
              onOpenListing={onOpenListing}
              onOpenProfile={onOpenProfile}
              onOpenRequest={(requestId) => onOpenRequest(requestId, activeConversation.isOwner ? 'incoming' : 'outgoing')}
              onToast={onToast}
            />
          ) : (
            <div className="chat-desktop-empty">
              <div><MessageCircle size={44} /></div>
              <SectionTitle>Выберите переписку</SectionTitle>
              <DescriptionText as="p">Сообщения и карточки бронирования откроются здесь.</DescriptionText>
            </div>
          )}
        </section>
      </main>

      <span className="sr-only">Режим данных: {CHAT_DATA_MODE}</span>
    </div>
  );
}
