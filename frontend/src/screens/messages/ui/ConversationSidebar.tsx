import { Clock3, Hourglass, MailOpen, MessageCircle } from 'lucide-react';
import type { RefObject, UIEventHandler } from 'react';
import type { Conversation, ConversationSort } from '@features/chat';
import { CountedTabs, EmptyState, PageTitle, PersonalListToolbar } from '@ui';
import { ConversationRow } from './ConversationRow';

export type ConversationTab = 'all' | 'renting' | 'hosting';

const filterOptions: Array<{ id: ConversationTab; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'renting', label: 'Я снимаю' },
  { id: 'hosting', label: 'Я сдаю' },
];

const sortOptions: Array<{ id: ConversationSort; label: string }> = [
  { id: 'recent', label: 'Сначала новые' },
  { id: 'oldest', label: 'Сначала старые' },
  { id: 'unread', label: 'Сначала непрочитанные' },
];

interface ConversationSidebarProps {
  hidden: boolean;
  conversations: Conversation[];
  filtered: Conversation[];
  selectedConversationId: number | null;
  query: string;
  sort: ConversationSort;
  sortOpen: boolean;
  filter: ConversationTab;
  emptyTitle: string;
  emptySubtitle: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: UIEventHandler<HTMLDivElement>;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: ConversationSort) => void;
  onSortOpenChange: (open: boolean) => void;
  onFilterChange: (filter: ConversationTab) => void;
  onOpenConversation: (conversationId: number) => void;
}

export function ConversationSidebar({
  hidden,
  conversations,
  filtered,
  selectedConversationId,
  query,
  sort,
  sortOpen,
  filter,
  emptyTitle,
  emptySubtitle,
  scrollRef,
  onScroll,
  onQueryChange,
  onSortChange,
  onSortOpenChange,
  onFilterChange,
  onOpenConversation,
}: ConversationSidebarProps) {
  return (
    <aside className={`chat-sidebar ${hidden ? 'is-chrome-hidden' : ''}`} aria-label="Переписки">
      <div className="chat-sidebar-heading">
        <PageTitle>Сообщения</PageTitle>
      </div>

      <div className="chat-list-stack">
        <div className="chat-list-controls">
          {conversations.length ? (
            <PersonalListToolbar
              className="chat-toolbar"
              query={query}
              onQueryChange={onQueryChange}
              placeholder="Поиск по перепискам..."
              sort={sort}
              sortOpen={sortOpen}
              onSortOpenChange={onSortOpenChange}
              onSortChange={onSortChange}
              sortOptions={sortOptions.map((option) => ({
                value: option.id,
                label: option.label,
                icon: option.id === 'recent' ? <Clock3 size={18} /> : option.id === 'oldest' ? <Hourglass size={18} /> : <MailOpen size={18} />,
              }))}
            />
          ) : null}

          <CountedTabs
            mode="list"
            className="chat-filter-tabs"
            semantic="filter"
            value={filter}
            ariaLabel="Тип переписок"
            items={filterOptions.map((option) => ({
              value: option.id,
              label: option.label,
              count: option.id === 'all' ? conversations.length : conversations.filter((item) => option.id === 'hosting' ? item.isOwner : !item.isOwner).length,
            }))}
            onChange={onFilterChange}
          />
        </div>

        <div ref={scrollRef} className="conversation-list" data-lenis-prevent onScroll={onScroll}>
          {filtered.length ? filtered.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === selectedConversationId}
              onOpen={() => onOpenConversation(conversation.id)}
            />
          )) : (
            <EmptyState icon={<MessageCircle size={28} />} title={emptyTitle} description={emptySubtitle} />
          )}
        </div>
      </div>
    </aside>
  );
}
