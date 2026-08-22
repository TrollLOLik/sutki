import { MessageCircle } from 'lucide-react';
import { BadgeText, DescriptionText, SectionTitle } from '@ui';
import type { ChatDialogController } from '../model/useChatDialogController';
import { formatDay } from '../model/formatters';
import { MessageItem } from './MessageItem';

interface ChatMessageListProps {
  controller: ChatDialogController;
  onOpenRequest: (requestId: number) => void;
  onToast: (message: string) => void;
}

export function ChatMessageList({ controller, onOpenRequest, onToast }: ChatMessageListProps) {
  const {
    liveConversation,
    listRef,
    visibleMessages,
    messageMap,
    conversationGalleryImages,
    fullName,
    latestBookingEvent,
    handleMessageListScroll,
    openActions,
    startReply,
    jumpToReply,
    setConfirmingRequestId,
    setRejectingRequestId,
    cancelBooking,
    preserveThreadPosition,
  } = controller;

  return (
    <div className="chat-message-list" ref={listRef} data-lenis-prevent onScroll={handleMessageListScroll}>
      {visibleMessages.length ? visibleMessages.map((message, index) => {
        const previous = visibleMessages[index - 1];
        const showDate = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
        return (
          <div key={message.id} className="chat-message-block">
            {showDate ? <div className="chat-date-divider"><BadgeText weight={400} color="muted">{formatDay(message.createdAt)}</BadgeText></div> : null}
            <MessageItem
              message={message}
              reply={message.replyToId ? messageMap.get(message.replyToId) : undefined}
              conversationGalleryImages={conversationGalleryImages}
              otherName={fullName}
              isOwner={liveConversation.isOwner}
              actionable={message.booking?.event === 'new' && latestBookingEvent.get(message.booking.requestId) === 'new'}
              onActions={() => openActions(message)}
              onReply={() => startReply(message)}
              onReplyJump={jumpToReply}
              onConfirm={(requestId) => setConfirmingRequestId(requestId)}
              onReject={(requestId) => setRejectingRequestId(requestId)}
              onCancel={cancelBooking}
              onOpenRequest={(requestId) => { preserveThreadPosition(); onOpenRequest(requestId); }}
              onToast={onToast}
            />
          </div>
        );
      }) : (
        <div className="chat-thread-empty">
          <div><MessageCircle size={42} /></div>
          <SectionTitle>Начните общение</SectionTitle>
          <DescriptionText as="p">Уточните время прибытия, правила проживания или индивидуальные условия заселения.</DescriptionText>
        </div>
      )}
    </div>
  );
}
