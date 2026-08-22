import { Check, CheckCheck, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import type { ChatAttachment, ChatMessage } from '@features/chat';
import { BadgeText, BodyText, DescriptionText, IconButton, OverlaySurface, Pressable, SectionTitle } from '@ui';
import { formatTime, latestMessagePreview } from '../model/formatters';
import { BookingStatusCard } from './BookingStatusCard';
import { MessageAttachments } from './MessageAttachments';

export interface MessageItemProps {
  message: ChatMessage;
  reply?: ChatMessage;
  conversationGalleryImages?: ChatAttachment[];
  otherName: string;
  isOwner: boolean;
  actionable: boolean;
  onActions: () => void;
  onReply: () => void;
  onReplyJump: (messageId: number) => void;
  onConfirm: (requestId: number) => void;
  onReject: (requestId: number) => void;
  onCancel: (requestId: number) => void;
  onOpenRequest: (requestId: number) => void;
  onToast: (message: string) => void;
}

export function MessageItem({
  message,
  reply,
  conversationGalleryImages,
  otherName,
  isOwner,
  actionable,
  onActions,
  onReply,
  onReplyJump,
  onConfirm,
  onReject,
  onCancel,
  onOpenRequest,
  onToast,
}: MessageItemProps) {
  const holdTimerRef = useRef<number | null>(null);
  const swipeRef = useRef({ pointerId: -1, startX: 0, startY: 0, offset: 0, active: false });
  const gallerySwipeRef = useRef<{ x: number; y: number } | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const messageGalleryImages = message.attachments?.filter((item) => item.kind === 'image') ?? [];
  const galleryImages = conversationGalleryImages ?? messageGalleryImages;

  if (message.kind === 'booking_status' && message.booking) {
    return <BookingStatusCard message={message} payload={message.booking} isOwner={isOwner} actionable={actionable} onConfirm={onConfirm} onReject={onReject} onCancel={onCancel} onOpenRequest={onOpenRequest} />;
  }
  if (message.kind === 'system') {
    return <div id={`chat-message-${message.id}`} className="chat-system-message"><BadgeText weight={400} color="muted">{message.body}</BadgeText></div>;
  }
  const mine = message.senderId === 'me';
  const cancelLongPress = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };
  const startLongPress = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    cancelLongPress();
    swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offset: 0, active: true };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.transition = 'none';
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      onActions();
    }, 280);
  };
  const moveSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe.active || swipe.pointerId !== event.pointerId || event.pointerType === 'mouse') return;
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    if (Math.abs(deltaX) > 7 || Math.abs(deltaY) > 7) cancelLongPress();
    if (Math.abs(deltaY) > Math.abs(deltaX) && swipe.offset === 0) return;
    event.preventDefault();
    event.stopPropagation();
    cancelLongPress();
    swipe.offset = Math.max(0, Math.min(72, deltaX));
    event.currentTarget.style.transform = `translate3d(${swipe.offset}px, 0, 0)`;
  };
  const finishSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    cancelLongPress();
    if (!swipe.active || swipe.pointerId !== event.pointerId) return;
    swipe.active = false;
    event.currentTarget.style.transition = 'transform 180ms ease-out';
    event.currentTarget.style.transform = '';
    if (swipe.offset >= 52) onReply();
  };
  const openKeyboardActions = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      onActions();
    }
  };
  const attachmentOnly = Boolean(message.attachments?.length && !message.body);
  const imageOnly = Boolean(attachmentOnly && message.attachments?.every((item) => item.kind === 'image'));
  const imageCaption = Boolean(!message.deletedAt && message.body && message.attachments?.length && message.attachments.every((item) => item.kind === 'image'));
  const messageMeta = (
    <span className="chat-message-meta">
      {message.editedAt ? <BadgeText as="em" weight={400} color="inherit">ред.</BadgeText> : null}
      <BadgeText as="time" weight={400} color="inherit">{formatTime(message.createdAt)}</BadgeText>
      {mine ? message.delivery === 'read' ? <CheckCheck size={13} /> : <Check size={13} /> : null}
    </span>
  );
  const changeGalleryImage = (direction: number) => setGalleryIndex((current) => current == null || galleryImages.length === 0
    ? current
    : (current + direction + galleryImages.length) % galleryImages.length);
  const finishGallerySwipe = (event: ReactTouchEvent<HTMLElement>) => {
    const start = gallerySwipeRef.current;
    gallerySwipeRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) changeGalleryImage(deltaX < 0 ? 1 : -1);
  };
  return (
    <>
    <div id={`chat-message-${message.id}`} className={`chat-bubble-row ${mine ? 'mine' : 'incoming'}`}>
<div
        className={`chat-bubble ${attachmentOnly ? 'media-only' : ''} ${imageOnly ? 'image-only' : ''} ${imageCaption ? 'has-image-caption' : ''}`}
        tabIndex={message.deletedAt ? -1 : 0}
        onContextMenu={message.deletedAt ? undefined : (event: ReactMouseEvent<HTMLDivElement>) => { event.preventDefault(); onActions(); }}
        onKeyDown={message.deletedAt ? undefined : openKeyboardActions}
        onPointerDown={message.deletedAt ? undefined : startLongPress}
        onPointerMove={message.deletedAt ? undefined : moveSwipe}
        onPointerUp={message.deletedAt ? undefined : finishSwipe}
        onPointerCancel={message.deletedAt ? undefined : finishSwipe}
      >
        {reply && !message.deletedAt ? (
          <Pressable className={`chat-quote ${reply.deletedAt ? 'is-deleted' : ''}`} onClick={() => onReplyJump(reply.id)}>
            {reply.deletedAt ? (
              <DescriptionText color="inherit" truncate>Сообщение удалено</DescriptionText>
            ) : (
              <>
                <BadgeText as="strong" color="inherit" truncate>{reply.senderId === 'me' ? 'Вы' : otherName}</BadgeText>
                <DescriptionText color="inherit" truncate>{latestMessagePreview(reply)}</DescriptionText>
              </>
            )}
          </Pressable>
        ) : null}
        {!message.deletedAt && message.attachments?.length ? <MessageAttachments attachments={message.attachments} onOpenImage={(attachmentId) => {
          const index = galleryImages.findIndex((item) => item.id === attachmentId);
          setGalleryIndex(index >= 0 ? index : 0);
        }} /> : null}
        {imageCaption ? (
          <div className="chat-image-caption-copy"><BodyText as="p" color="inherit">{message.body}</BodyText>{messageMeta}</div>
        ) : (
          <>{message.deletedAt ? <BodyText as="p" className="chat-deleted-message" color="inherit">Сообщение удалено</BodyText> : message.body ? <BodyText as="p" color="inherit">{message.body}</BodyText> : null}{messageMeta}</>
        )}
      </div>
    </div>
    <OverlaySurface open={galleryIndex != null} onClose={() => setGalleryIndex(null)} ariaLabel="Просмотр фотографий" layerClassName="detail-lightbox-layer" className="detail-lightbox">
      <header><IconButton variant="plain" label="Закрыть" icon={<X size={24} />} onClick={() => setGalleryIndex(null)} /><SectionTitle as="strong" color="inverse">{(galleryIndex ?? 0) + 1} / {galleryImages.length}</SectionTitle></header>
      {galleryImages.length > 1 ? <IconButton variant="plain" className="lightbox-arrow left" label="Предыдущее фото" icon={<ChevronLeft size={28} />} onClick={() => changeGalleryImage(-1)} /> : null}
      <div
        className="lightbox-swipe-stage"
        onTouchStart={(event) => { const touch = event.touches[0]; gallerySwipeRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }}
        onTouchMove={(event) => { const start = gallerySwipeRef.current; const touch = event.touches[0]; if (start && touch && Math.abs(touch.clientX - start.x) > Math.abs(touch.clientY - start.y) && event.cancelable) event.preventDefault(); }}
        onTouchEnd={finishGallerySwipe}
        onTouchCancel={() => { gallerySwipeRef.current = null; }}
      >
        {galleryImages[galleryIndex ?? 0] ? <img src={galleryImages[galleryIndex ?? 0].url} alt={galleryImages[galleryIndex ?? 0].name} draggable={false} /> : null}
      </div>
      {galleryImages.length > 1 ? <IconButton variant="plain" className="lightbox-arrow right" label="Следующее фото" icon={<ChevronRight size={28} />} onClick={() => changeGalleryImage(1)} /> : null}
      {galleryImages.length > 1 ? <div className="lightbox-thumbnails">{galleryImages.map((image, index) => <Pressable key={image.id} className={galleryIndex === index ? 'active' : ''} onClick={() => setGalleryIndex(index)}><img src={image.url} alt="" /></Pressable>)}</div> : null}
    </OverlaySurface>
    </>
  );
}
