import { Edit3, FileText, Paperclip, Reply, Send, Trash2, Video, X } from 'lucide-react';
import { useRef, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ChatAttachment, ChatMessage } from '@features/chat';
import { BadgeText, BodyText, Button, DescriptionText, IconButton, TextArea } from '@ui';
import { latestMessagePreview } from '../model/formatters';

interface ChatComposerProps {
  deleted: boolean;
  staged: ChatAttachment[];
  editingMessage?: ChatMessage;
  replyMessage?: ChatMessage;
  fullName: string;
  quickReplies: string[];
  input: string;
  onInputChange: (value: string) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onPickQuickReply: (reply: string) => void;
  onSendQuickReply: (reply: string) => void;
  onOpenAttachmentMenu: () => void;
  onSubmit: (event?: FormEvent) => void;
}

export function ChatComposer({
  deleted,
  staged,
  editingMessage,
  replyMessage,
  fullName,
  quickReplies,
  input,
  onInputChange,
  onRemoveAttachment,
  onCancelEdit,
  onCancelReply,
  onPickQuickReply,
  onSendQuickReply,
  onOpenAttachmentMenu,
  onSubmit,
}: ChatComposerProps) {
  if (deleted) {
    return (
      <div className="chat-deleted-composer">
        <Trash2 size={20} />
        <div><BodyText as="strong" weight={500}>Профиль удалён</BodyText><DescriptionText>Отправлять новые сообщения этому пользователю нельзя.</DescriptionText></div>
      </div>
    );
  }

  return (
    <div className="chat-composer-zone">
      {staged.length ? (
        <div className="chat-staged-row">
          {staged.map((item) => (
            <div key={item.id} className={`chat-staged-item ${item.kind}`}>
              {item.kind === 'image' ? <img src={item.url} alt="" /> : item.kind === 'video' ? <Video size={21} /> : <FileText size={21} />}
              <BadgeText color="inverse" truncate>{item.name}</BadgeText>
              <IconButton variant="plain" label="Удалить вложение" icon={<X size={14} />} onClick={() => onRemoveAttachment(item.id)} />
            </div>
          ))}
        </div>
      ) : null}

      {editingMessage ? (
        <div className="chat-preview-bar edit"><Edit3 size={18} /><div><BadgeText as="strong" color="inherit">Изменение сообщения</BadgeText><DescriptionText truncate>{editingMessage.body}</DescriptionText></div><IconButton variant="plain" label="Отменить изменение" icon={<X size={17} />} onClick={onCancelEdit} /></div>
      ) : replyMessage ? (
        <div className="chat-preview-bar"><Reply size={18} /><div><BadgeText as="strong" color="inherit">{replyMessage.senderId === 'me' ? 'Вы' : fullName}</BadgeText><DescriptionText truncate>{latestMessagePreview(replyMessage)}</DescriptionText></div><IconButton variant="plain" label="Отменить ответ" icon={<X size={17} />} onClick={onCancelReply} /></div>
      ) : null}

      {!input && !editingMessage && !staged.length ? (
        <div className="chat-quick-replies" aria-label="Быстрые ответы">
          {quickReplies.map((reply) => <QuickReplyButton key={reply} reply={reply} onPick={onPickQuickReply} onSend={onSendQuickReply} />)}
        </div>
      ) : null}

      <form className="chat-composer" onSubmit={onSubmit}>
        <IconButton variant="plain" className="chat-attach-button" label="Добавить вложение" icon={<Paperclip size={21} />} disabled={Boolean(editingMessage)} onClick={onOpenAttachmentMenu} />
        <TextArea
          bare
          value={input}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onInputChange(event.target.value)}
          placeholder={staged.length ? 'Добавьте подпись...' : 'Сообщение...'}
          rows={1}
          onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <IconButton variant="plain" className="chat-send-button" type="submit" label="Отправить сообщение" icon={<Send size={19} />} disabled={!input.trim() && staged.length === 0} />
      </form>
    </div>
  );
}

function QuickReplyButton({ reply, onPick, onSend }: { reply: string; onPick: (reply: string) => void; onSend: (reply: string) => void }) {
  const holdTimerRef = useRef<number | null>(null);
  const sentByHoldRef = useRef(false);

  const cancelHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  return (
    <Button
      size="sm"
      mode="soft"
      tone="neutral"
      title="Вставить быстрый ответ"
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') return;
        sentByHoldRef.current = false;
        holdTimerRef.current = window.setTimeout(() => {
          sentByHoldRef.current = true;
          holdTimerRef.current = null;
          onSend(reply);
        }, 320);
      }}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onClick={() => {
        if (sentByHoldRef.current) {
          sentByHoldRef.current = false;
          return;
        }
        onPick(reply);
      }}
    >{reply}</Button>
  );
}
