import { ChevronRight, Image as ImageIcon, ShieldCheck, X } from 'lucide-react';
import type { Conversation } from '@features/chat';
import { BadgeText, BodyText, Button, DescriptionText, IconButton } from '@ui';
import { roomsLabel } from '../model/formatters';

interface ChatDialogContextProps {
  conversation: Conversation;
  showSafety: boolean;
  onHideSafety: () => void;
  onOpenListing: (listingId: number) => void;
  onPreserveThreadPosition: () => void;
}

export function ChatDialogContext({ conversation, showSafety, onHideSafety, onOpenListing, onPreserveThreadPosition }: ChatDialogContextProps) {
  return (
    <div className="chat-dialog-context">
      {conversation.listing ? (
        <div className="chat-listing-context">
          <div className="chat-listing-copy">
            {conversation.listing.coverUrl ? <img src={conversation.listing.coverUrl} alt="" /> : <span><ImageIcon size={24} /></span>}
            <div>
              <BodyText as="strong" weight={500} truncate>{roomsLabel(conversation.listing.rooms)}, {conversation.listing.address}</BodyText>
              <BadgeText as="small" weight={400} color="muted">{conversation.listing.price.toLocaleString('ru-RU')} ₽ / сутки</BadgeText>
            </div>
          </div>
          <Button size="sm" mode="ghost" tone="primary" endIcon={<ChevronRight size={16} />} onClick={() => { onPreserveThreadPosition(); onOpenListing(conversation.listing!.id); }}>Подробнее</Button>
        </div>
      ) : null}

      {showSafety ? (
        <div className="chat-safety-notice">
          <ShieldCheck size={19} />
          <DescriptionText color="inherit">Не переводите предоплату вне приложения и не переходите по внешним ссылкам на оплату.</DescriptionText>
          <IconButton variant="plain" label="Скрыть предупреждение" icon={<X size={16} />} onClick={onHideSafety} />
        </div>
      ) : null}
    </div>
  );
}
