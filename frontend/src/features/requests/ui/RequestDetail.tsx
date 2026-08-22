import {
  CalendarDays,
  Check,
  CheckCircle2,
  House,
  MessageCircle,
  Moon,
  Phone,
  RefreshCw,
  RotateCcw,
  Star,
  Users,
  X,
} from 'lucide-react';
import {
  Avatar,
  BadgeText,
  BodyText,
  Button,
  CompactAlert,
  DescriptionText,
  HeroTitle,
  IconValueRow,
  ListCell,
  ListCellLink,
  ListPageHeader,
  SectionTitle,
  StickyActionBar,
  Surface,
  type ButtonSize,
} from '@ui';
import { useMediaQuery } from '@shared/lib/adaptivity';
import {
  formatGuestsCount,
  formatMoney,
  formatNightsCount,
  formatRequestCreatedAt,
  formatRequestLongDateRange,
  getFullPersonName,
  getRequestNights,
} from '../model/formatters';
import {
  getRequestCapabilities,
  getRequestStatusMeta,
  type RequestCapabilities,
} from '../model/status';
import type { RentalRequest } from '../model/types';

interface RequestDetailProps {
  request: RentalRequest;
  busy: boolean;
  onBack: () => void;
  onOpenListing: () => void;
  onOpenChat: () => void;
  onOpenPerson?: () => void;
  onReview: () => void;
  onRepeat: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onCancel: () => void;
}

export function RequestDetail({
  request,
  busy,
  onBack,
  onOpenListing,
  onOpenChat,
  onOpenPerson,
  onReview,
  onRepeat,
  onConfirm,
  onReject,
  onCancel,
}: RequestDetailProps) {
  const meta = getRequestStatusMeta(request);
  const incoming = request.direction === 'incoming';
  const person = incoming ? request.guest : request.listing.owner;
  const nights = getRequestNights(request);
  const total = request.listing.price * nights;
  const capabilities = getRequestCapabilities(request);
  const desktop = useMediaQuery('(min-width: 900px)');
  const personDeleted = person.deleted === true;

  const statusCard = (
    <Surface as="section" className="request-status-card" radius="lg">
      <span className={`request-status-icon ${meta.tone} status-${request.status}`}><meta.icon size={25} /></span>
      <div>
        <SectionTitle as="h1">{meta.label}</SectionTitle>
        <DescriptionText as="p">{meta.description}</DescriptionText>
        <BadgeText as="small" weight={400} color="muted">Создана {formatRequestCreatedAt(request.createdAt, true)}</BadgeText>
      </div>
    </Surface>
  );

  const listingCard = (
    <ListCell
      className="request-surface request-listing-card"
      multiline
      onClick={onOpenListing}
      before={<span className="request-listing-image">{request.listing.coverUrl ? <img src={request.listing.coverUrl} alt="" /> : <House size={29} />}</span>}
      title={<BodyText weight={500}>{request.listing.address}</BodyText>}
      subtitle={<span className="request-listing-copy"><DescriptionText>{request.listing.city}</DescriptionText><BodyText weight={500} color="accent">{formatMoney(request.listing.price)} ₽ / ночь</BodyText></span>}
    />
  );

  const reasonCard = request.status === 'cancelled' && request.rejectionReason ? (
    <CompactAlert
      className="request-reason-card"
      tone="danger"
      title={request.cancelledBy === 'owner' ? 'Причина отклонения' : 'Причина отмены'}
      descriptionColor="secondary"
    >
      {request.rejectionReason}
    </CompactAlert>
  ) : null;

  const staySection = (
    <section className="request-detail-section request-stay-section">
      <SectionTitle>Проживание</SectionTitle>
      <Surface className="request-info-card" radius="lg">
        <IconValueRow className="request-info-row" icon={<CalendarDays size={19} />} label="Заезд и выезд" value={formatRequestLongDateRange(request)} />
        <IconValueRow className="request-info-row" icon={<Moon size={19} />} label="Продолжительность" value={formatNightsCount(nights)} />
        <IconValueRow className="request-info-row" icon={<Users size={19} />} label="Гости" value={formatGuestsCount(request.guests)} />
      </Surface>
    </section>
  );

  const totalCard = (
    <Surface as="section" className="request-total-card" radius="lg">
      <span>
        <DescriptionText as="small" weight={500}>Итого</DescriptionText>
        <BadgeText as="p" weight={400} color="muted">{formatMoney(request.listing.price)} ₽ × {formatNightsCount(nights)}</BadgeText>
      </span>
      <HeroTitle as="strong">{formatMoney(total)} ₽</HeroTitle>
    </Surface>
  );

  const commentSection = request.message.trim() ? (
    <section className="request-detail-section request-comment-section">
      <SectionTitle>{incoming ? 'Комментарий гостя' : 'Комментарий'}</SectionTitle>
      <Surface className="request-comment-card" radius="lg"><MessageCircle size={20} /><BadgeText as="p" weight={400} color="secondary">{request.message}</BadgeText></Surface>
    </section>
  ) : null;

  const personSection = (
    <section className="request-detail-section request-person-section">
      <SectionTitle>{incoming ? 'Гость' : 'Владелец'}</SectionTitle>
      <Surface className="request-person-card" radius="lg">
        <ListCell
          className={`request-person-main ${personDeleted ? 'is-deleted' : ''}`}
          onClick={personDeleted ? undefined : onOpenPerson}
          disabled={personDeleted}
          chevron={!personDeleted}
          before={<Avatar className="request-person-avatar" src={person.avatarUrl} name={getFullPersonName(request)} size="md" />}
          title={<BodyText weight={500}>{personDeleted ? 'Профиль удалён' : getFullPersonName(request)}{!personDeleted && person.verified ? <CheckCircle2 size={17} /> : null}</BodyText>}
          subtitle={personDeleted
            ? <BadgeText color="muted">Переход в профиль недоступен</BadgeText>
            : person.rating
            ? <BadgeText color="muted"><Star size={14} fill="currentColor" />{person.rating.toFixed(1)} · {person.reviewsCount ?? 0} отзывов</BadgeText>
            : <BadgeText color="muted">Профиль пользователя</BadgeText>}
        />
        {capabilities.contact ? <ListCellLink className="request-phone-row" href={`tel:${person.phone}`} before={<Phone size={19} />} eyebrow="Позвонить" title={person.phone} /> : null}
      </Surface>
    </section>
  );

  const desktopActions = (
    <RequestActions className="request-detail-desktop-actions" size="sm" request={request} capabilities={capabilities} busy={busy} onOpenChat={onOpenChat} onReview={onReview} onRepeat={onRepeat} onConfirm={onConfirm} onReject={onReject} onCancel={onCancel} />
  );

  return (
    <main className="request-detail-page">
      <ListPageHeader presentation="mobile" className="request-detail-header" title={incoming ? 'Детали заявки' : 'Детали брони'} subtitle={`№${request.id}`} onBack={onBack} />
      <ListPageHeader presentation="desktop" className="request-detail-desktop-header" title={incoming ? 'Детали заявки' : 'Детали брони'} subtitle={`№${request.id}`} onBack={onBack} />

      {desktop ? (
        <div className="request-detail-content request-detail-content--desktop-grid">
          <div className="request-detail-primary-column">
            {statusCard}
            {reasonCard}
            {staySection}
            {commentSection}
          </div>
          <aside className="request-detail-summary-column">
            {listingCard}
            {personSection}
            {totalCard}
            {desktopActions}
          </aside>
        </div>
      ) : (
        <div className="request-detail-content">
          {statusCard}
          {listingCard}
          {reasonCard}
          {staySection}
          {totalCard}
          {commentSection}
          {personSection}
        </div>
      )}

      <StickyActionBar className="request-detail-footer">
        <RequestActions className="request-detail-mobile-actions" size="md" request={request} capabilities={capabilities} busy={busy} onOpenChat={onOpenChat} onReview={onReview} onRepeat={onRepeat} onConfirm={onConfirm} onReject={onReject} onCancel={onCancel} />
      </StickyActionBar>
    </main>
  );
}

function RequestActions({ className, size, request, capabilities, busy, onOpenChat, onReview, onRepeat, onConfirm, onReject, onCancel }: {
  className: string;
  size: ButtonSize;
  request: RentalRequest;
  capabilities: RequestCapabilities;
  busy: boolean;
  onOpenChat: () => void;
  onReview: () => void;
  onRepeat: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const pairChatAndRepeat = capabilities.chat && capabilities.repeat && !capabilities.review;
  return <div className={className}>
    {capabilities.review && !capabilities.repeat ? <Button size={size} mode="solid" tone="primary" stretched startIcon={<Star />} onClick={onReview}>{request.reviewLabel || 'Оставить отзыв'}</Button> : null}
    {capabilities.cancel ? <div className="request-action-pair">
      {capabilities.chat ? <Button size={size} mode="soft" tone="neutral" stretched startIcon={<MessageCircle />} onClick={onOpenChat}>Открыть чат</Button> : null}
      <Button size={size} mode="outline" tone="danger" stretched startIcon={<RotateCcw />} disabled={busy} onClick={onCancel}>Отменить заявку</Button>
    </div> : pairChatAndRepeat ? <div className="request-action-pair">
      <Button size={size} mode="soft" tone="neutral" stretched startIcon={<MessageCircle />} onClick={onOpenChat}>Открыть чат</Button>
      <Button size={size} mode="soft" tone="neutral" stretched startIcon={<RefreshCw />} onClick={onRepeat}>Повторить</Button>
    </div> : capabilities.chat ? <Button size={size} mode="soft" tone="neutral" stretched startIcon={<MessageCircle />} onClick={onOpenChat}>Открыть чат</Button> : null}
    {capabilities.confirm || capabilities.reject ? <div className="request-detail-decision">
      {capabilities.reject ? <Button size={size} mode="outline" tone="danger" stretched startIcon={<X />} disabled={busy} onClick={onReject}>Отклонить</Button> : null}
      {capabilities.confirm ? <Button className="request-accept-button" size={size} mode="solid" tone="primary" stretched startIcon={<Check />} disabled={busy} onClick={onConfirm}>Принять</Button> : null}
    </div> : null}
    {capabilities.repeat && !pairChatAndRepeat ? <div className="request-action-pair">
      <Button size={size} mode="soft" tone="neutral" stretched startIcon={<RefreshCw />} onClick={onRepeat}>Повторить</Button>
      {capabilities.review ? <Button size={size} mode="solid" tone="primary" stretched startIcon={<Star />} onClick={onReview}>{request.reviewLabel || 'Оставить отзыв'}</Button> : null}
    </div> : null}
  </div>;
}
