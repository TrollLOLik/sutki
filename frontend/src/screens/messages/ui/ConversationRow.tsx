import { BellOff, Check, CheckCheck, CircleUserRound, Home, Pin } from 'lucide-react';
import type { Conversation } from '@features/chat';
import { BadgeText, BodyText, DescriptionText, Pressable } from '@ui';
import { latestMessage, latestMessagePreview, relativeListTime, roomsLabel } from '../model/formatters';

export interface ConversationRowProps {
  conversation: Conversation;
  selected: boolean;
  onOpen: () => void;
}

export function ConversationRow({ conversation, selected, onOpen }: ConversationRowProps) {
  const last = latestMessage(conversation);
  const isMine = last?.senderId === 'me';
  const fullName = conversation.otherUser.deleted
    ? 'Удалённый профиль'
    : `${conversation.otherUser.name} ${conversation.otherUser.surname}`.trim();

  return (
    <Pressable className={`conversation-row ${selected ? 'selected' : ''} ${conversation.unreadCount ? 'unread' : ''}`} onClick={onOpen}>
      <span className="conversation-avatar-wrap">
        {conversation.otherUser.avatarUrl && !conversation.otherUser.deleted
          ? <img src={conversation.otherUser.avatarUrl} alt="" />
          : <span className="conversation-avatar-placeholder"><CircleUserRound size={25} /></span>}
        {conversation.unreadCount ? <i /> : null}
      </span>
      <span className="conversation-copy">
        <span className="conversation-title-line">
          <BodyText as="strong" weight={500} truncate>{fullName}</BodyText>
          <BadgeText as="time" weight={400} color="muted">{last ? relativeListTime(last.createdAt) : ''}</BadgeText>
        </span>
        {conversation.listing ? (
          <span className="conversation-listing-line">
            <Home size={13} />
            <DescriptionText truncate>{roomsLabel(conversation.listing.rooms)}, {conversation.listing.address}</DescriptionText>
          </span>
        ) : null}
        <span className="conversation-preview-line">
          {isMine && last?.kind === 'user' ? (last.delivery === 'read' ? <CheckCheck size={15} /> : <Check size={15} />) : null}
          <DescriptionText truncate>{latestMessagePreview(last)}</DescriptionText>
          {conversation.muted ? <BellOff size={14} /> : null}
          {conversation.pinned ? <Pin size={14} /> : null}
          {conversation.unreadCount ? <BadgeText as="b" color="inverse">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</BadgeText> : null}
        </span>
      </span>
      {conversation.listing?.coverUrl ? <img className="conversation-listing-thumb" src={conversation.listing.coverUrl} alt="" /> : null}
    </Pressable>
  );
}
