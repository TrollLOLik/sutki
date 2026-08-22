import {
  CalendarDays,
  Check,
  ChevronRight,
  House,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Star,
  Users,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  BadgeText,
  Button,
  CompactAlert,
  DescriptionText,
  Pressable,
  SectionTitle,
} from '@ui';
import {
  formatGuestsCount,
  formatMoney,
  formatRequestCreatedAt,
  formatRequestDateRange,
  getCompactPersonName,
  getRequestNights,
} from '../model/formatters';
import { getRequestCapabilities, getRequestStatusMeta } from '../model/status';
import type { RentalRequest } from '../model/types';

interface RequestCardProps {
  request: RentalRequest;
  history: boolean;
  busy: boolean;
  onOpen: () => void;
  onChat: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onRepeat: () => void;
  onReview: () => void;
  onCancel: () => void;
}

export function RequestCard({
  request,
  history,
  busy,
  onOpen,
  onChat,
  onConfirm,
  onReject,
  onRepeat,
  onReview,
  onCancel,
}: RequestCardProps) {
  const meta = getRequestStatusMeta(request);
  const total = request.listing.price * getRequestNights(request);
  const incoming = request.direction === 'incoming';
  const capabilities = getRequestCapabilities(request);
  const person = incoming ? request.guest : request.listing.owner;
  const pairChatAndRepeat = capabilities.chat && capabilities.repeat && !capabilities.review;

  return (
    <article className="request-card ui-personal-collection-card">
      <Pressable className="request-card-main" onClick={onOpen}>
        <div className="request-card-top">
          <Badge className="request-status-badge" tone={meta.tone} before={<meta.icon size={14} />}><BadgeText color="inherit">{meta.label}</BadgeText></Badge>
          <BadgeText as="small" color="muted" truncate>№{request.id}</BadgeText>
        </div>

        <div className={`request-card-content ${incoming ? 'incoming' : ''}`}>
          {incoming ? (
            <Avatar className="request-card-media avatar" src={person.avatarUrl} name={person.name} size="xl" />
          ) : (
            <div className="request-card-media">
              {request.listing.coverUrl ? <img src={request.listing.coverUrl} alt="" /> : <House size={28} />}
            </div>
          )}
          <div className="request-card-copy">
            <div className="request-card-title-row">
              <SectionTitle as="h2">{incoming ? getCompactPersonName(request) : request.listing.address}</SectionTitle>
              {incoming && person.rating ? (
                <Badge className="request-rating" tone="primary" before={<Star size={13} fill="currentColor" />}><BadgeText color="inherit">{person.rating.toFixed(1)}</BadgeText></Badge>
              ) : incoming ? <BadgeText as="em" color="muted">Новый гость</BadgeText> : null}
            </div>
            <DescriptionText as="p" truncate>{incoming ? request.listing.address : request.listing.city}</DescriptionText>
            <BadgeText color="muted"><CalendarDays size={14} />{formatRequestDateRange(request)}</BadgeText>
            <BadgeText color="muted"><Users size={14} />{formatGuestsCount(request.guests)}</BadgeText>
          </div>
          <ChevronRight size={18} />
        </div>

        {request.rejectionReason ? (
          <CompactAlert
            className="request-card-alert"
            tone="danger"
            title={request.cancelledBy === 'owner' ? 'Причина отклонения' : 'Причина отмены'}
            descriptionColor="secondary"
          >
            {request.rejectionReason}
          </CompactAlert>
        ) : null}

        <div className="request-card-total">
          <span>
            <DescriptionText as="strong" weight={500}>{history && request.status === 'completed' ? 'Итого за проживание' : 'Стоимость проживания'}</DescriptionText>
            <BadgeText as="small" weight={400} color="muted">Создана {formatRequestCreatedAt(request.createdAt)}</BadgeText>
          </span>
          <SectionTitle as="b">{formatMoney(total)} ₽</SectionTitle>
        </div>
      </Pressable>

      {capabilities.confirm || capabilities.reject || capabilities.cancel || capabilities.repeat || capabilities.review || capabilities.chat ? (
        <div className="request-card-actions">
        {capabilities.review && !capabilities.repeat ? <Button size="sm" mode="solid" tone="primary" stretched startIcon={<Star />} onClick={onReview}>{request.reviewLabel || 'Оставить отзыв'}</Button> : null}
        {capabilities.cancel ? <div className="request-action-pair">
          {capabilities.chat ? <Button size="sm" mode="soft" tone="neutral" stretched startIcon={<MessageCircle />} onClick={onChat}>Чат</Button> : null}
          <Button size="sm" mode="outline" tone="danger" stretched startIcon={<RotateCcw />} disabled={busy} onClick={onCancel}>Отменить заявку</Button>
        </div> : pairChatAndRepeat ? <div className="request-action-pair">
          <Button size="sm" mode="soft" tone="neutral" stretched startIcon={<MessageCircle />} onClick={onChat}>Чат</Button>
          <Button size="sm" mode="soft" tone="neutral" stretched startIcon={<RefreshCw />} onClick={onRepeat}>Повторить</Button>
        </div> : capabilities.chat ? <Button size="sm" mode="soft" tone="neutral" stretched startIcon={<MessageCircle />} onClick={onChat}>Чат</Button> : null}
        {capabilities.confirm || capabilities.reject ? (
          <div className="request-decision-row">
            {capabilities.reject ? <Button size="sm" mode="outline" tone="danger" stretched startIcon={<X />} disabled={busy} onClick={onReject}>Отклонить</Button> : null}
            {capabilities.confirm ? <Button className="request-accept-button" size="sm" mode="solid" tone="primary" stretched startIcon={<Check />} disabled={busy} onClick={onConfirm}>Принять</Button> : null}
          </div>
        ) : null}
        {history && capabilities.repeat && !pairChatAndRepeat ? <div className="request-action-pair">
          <Button size="sm" mode="soft" tone="neutral" stretched startIcon={<RefreshCw />} onClick={onRepeat}>Повторить</Button>
          {capabilities.review ? <Button size="sm" mode="solid" tone="primary" stretched startIcon={<Star />} onClick={onReview}>{request.reviewLabel || 'Оставить отзыв'}</Button> : null}
        </div> : null}
        </div>
      ) : null}
    </article>
  );
}
