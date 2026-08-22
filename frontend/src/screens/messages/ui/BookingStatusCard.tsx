import { CalendarDays, Check, CircleX, Map as MapIcon, X } from 'lucide-react';
import type { BookingStatusPayload, ChatMessage } from '@features/chat';
import { BadgeText, BodyText, Button, DescriptionText } from '@ui';
import { formatBookingRange, formatTime, guestsLabel } from '../model/formatters';

interface BookingStatusCardProps {
  message: ChatMessage;
  payload: BookingStatusPayload;
  isOwner: boolean;
  actionable: boolean;
  onConfirm: (requestId: number) => void;
  onReject: (requestId: number) => void;
  onCancel: (requestId: number) => void;
  onOpenRequest: (requestId: number) => void;
}

export function BookingStatusCard({
  message,
  payload,
  isOwner,
  actionable,
  onConfirm,
  onReject,
  onCancel,
  onOpenRequest,
}: BookingStatusCardProps) {
  const meta = {
    new: { title: 'Новая заявка на бронирование', icon: <CalendarDays size={22} />, tone: 'primary' },
    confirmed: { title: 'Бронирование подтверждено', icon: <Check size={22} />, tone: 'success' },
    rejected: { title: 'Заявка отклонена', icon: <X size={22} />, tone: 'danger' },
    cancelled: { title: 'Заявка отменена гостем', icon: <CircleX size={21} />, tone: 'danger' },
  }[payload.event];

  return (
    <article id={`chat-message-${message.id}`} className={`chat-booking-card ${meta.tone} event-${payload.event}`}>
      <div className="chat-booking-head">
        <span>{meta.icon}</span>
        <div><BodyText as="strong" weight={500}>{meta.title}</BodyText><BadgeText as="small" weight={400} color="muted">{formatBookingRange(payload.startDate, payload.endDate)} · {guestsLabel(payload.guests)}</BadgeText></div>
      </div>
      {payload.reason ? <DescriptionText as="p">Причина: {payload.reason}</DescriptionText> : null}
      {payload.address ? <div className="chat-booking-address"><MapIcon size={16} /><DescriptionText color="inherit">{payload.address}</DescriptionText></div> : null}
      {isOwner && actionable ? (
        <div className="chat-booking-actions">
          <Button className="primary" size="sm" mode="solid" tone="primary" onClick={() => onConfirm(payload.requestId)}>Подтвердить</Button>
          <Button className="danger-outline" size="sm" mode="outline" tone="danger" onClick={() => onReject(payload.requestId)}>Отклонить</Button>
        </div>
      ) : null}
      {!isOwner && actionable ? <Button className="chat-booking-cancel" size="sm" mode="outline" tone="danger" stretched onClick={() => onCancel(payload.requestId)}>Отменить заявку</Button> : null}
      {payload.event === 'confirmed' ? <Button className="chat-booking-details" size="sm" mode="soft" tone="neutral" stretched onClick={() => onOpenRequest(payload.requestId)}>Открыть бронирование</Button> : null}
      <BadgeText as="time" weight={400} color="muted">{formatTime(message.createdAt)}</BadgeText>
    </article>
  );
}
