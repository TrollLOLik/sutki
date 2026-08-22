import { ChevronLeft, CircleUserRound, Phone } from 'lucide-react';
import type { Conversation } from '@features/chat';
import { BadgeText, BodyText, IconButton, IconButtonLink, Pressable } from '@ui';

interface ChatDialogHeaderProps {
  conversation: Conversation;
  fullName: string;
  presence: string;
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  onPreserveThreadPosition: () => void;
}

export function ChatDialogHeader({ conversation, fullName, presence, onBack, onOpenProfile, onPreserveThreadPosition }: ChatDialogHeaderProps) {
  return (
    <header className="chat-dialog-header">
      <IconButton variant="plain" className="chat-header-icon chat-mobile-back" label="Назад к сообщениям" icon={<ChevronLeft size={24} />} onClick={() => { onPreserveThreadPosition(); onBack(); }} />
      <Pressable className="chat-person-button" onClick={() => { onPreserveThreadPosition(); onOpenProfile(conversation.otherUser.id); }} disabled={conversation.otherUser.deleted}>
        {conversation.otherUser.avatarUrl && !conversation.otherUser.deleted
          ? <img src={conversation.otherUser.avatarUrl} alt="" />
          : <span><CircleUserRound size={23} /></span>}
        <span>
          <BodyText as="strong" weight={500} truncate>{fullName}</BodyText>
          <BadgeText as="small" weight={400} color="muted" className={conversation.otherUser.online ? 'online' : ''}>{presence}</BadgeText>
        </span>
      </Pressable>
      <div className="chat-header-actions">
        {conversation.otherUser.phone && !conversation.otherUser.deleted ? (
          <IconButtonLink className="chat-header-icon primary" label="Позвонить" href={'tel:' + conversation.otherUser.phone} icon={<Phone size={21} />} />
        ) : null}

      </div>
    </header>
  );
}
