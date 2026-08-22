import { BedDouble, CalendarPlus, ChevronRight, CircleAlert, Edit3, Eye, EyeOff, Expand, Heart, Home, MapPin, Rocket, Send, Sparkles, Star, TrendingUp } from 'lucide-react';
import type { CSSProperties, KeyboardEvent, MouseEvent, SyntheticEvent } from 'react';
import type { Listing } from '@shared/data/listings';
import { BadgeText, BodyText, Button, DescriptionText, IconButton, PageTitle, SectionTitle } from '@ui';
import './listing-card.css';
import type { ListingLayoutMode } from './ListingLayoutToggle';
import { ListingStatusBadge } from './ListingStatusBadge';

function roomsLabel(rooms: number) {
  if (rooms <= 0) return 'Студия';
  if (rooms === 1) return '1 комната';
  if (rooms >= 2 && rooms <= 4) return `${rooms} комнаты`;
  return `${rooms} комнат`;
}

function cardTitle(rooms: number) {
  return rooms <= 0 ? 'Современная студия' : `Уютная ${rooms}-комн. квартира`;
}

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export type ListingCardMode = 'status' | 'plain' | 'owner';

export type ListingCardProps = {
  listing: Listing;
  layout: ListingLayoutMode;
  mode: ListingCardMode;
  favorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
  onCardSelect?: () => void;
  openLabel?: string;
  onBook?: () => void;
  onEdit?: () => void;
  onPromote?: () => void;
  onUnpublish?: () => void;
  onPublish?: () => void;
  ownerStatus?: {
    label: string;
    tone: 'warning' | 'danger' | 'neutral';
    reason?: string;
  };
  showFavorite?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function ListingCard({ listing, layout, mode, favorite, onToggleFavorite, onOpen, onCardSelect, openLabel = 'Открыть', onBook, onEdit, onPromote, onUnpublish, onPublish, ownerStatus, showFavorite = true, className = '', style }: ListingCardProps) {
  const useFallbackImage = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === 'true') return;
    image.dataset.fallbackApplied = 'true';
    image.src = '/listings/flat-1.jpg';
  };
  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return;
    (onCardSelect ?? onOpen)();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (onCardSelect ?? onOpen)();
    }
  };

  if (layout === 'grid') {
    return (
      <article className={`listing-card ui-listing-card listing-card--${mode} grid-card ${listing.promoted === 'highlight' ? 'highlighted' : ''} ${className}`.trim()} style={style} role="link" tabIndex={0} onClick={handleCardClick} onKeyDown={handleCardKeyDown}>
        <div className="grid-image-wrap">
          <img src={listing.coverUrl} alt="Интерьер квартиры" onError={useFallbackImage} />
          <ListingCardBadges listing={listing} mode={mode} />
          {showFavorite ? <IconButton
            className={`image-heart ${favorite ? 'is-favorite' : ''}`}
            label={favorite ? 'Убрать из избранного' : 'В избранное'}
            size="sm"
            mode="soft"
            tone="neutral"
            icon={<Heart size={19} fill={favorite ? 'currentColor' : 'none'} />}
            onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }}
          /> : null}
        </div>
        <div className="grid-card-body">
          <div className="grid-price-row">
            <SectionTitle as="strong">{rub(listing.price)} ₽</SectionTitle>
            <DescriptionText color="inherit"><Star size={13} fill="currentColor" />{listing.rating.toFixed(1).replace('.', ',')}</DescriptionText>
          </div>
          <BodyText as="h3" weight={500}>{cardTitle(listing.rooms)}</BodyText>
          <DescriptionText as="p" truncate>{listing.address}</DescriptionText>
          <div className="grid-facts">
            <BadgeText color="secondary"><Expand size={12} />{listing.area} м²</BadgeText>
            <BadgeText color="secondary"><BedDouble size={12} />{roomsLabel(listing.rooms)}</BadgeText>
          </div>
          {mode === 'owner' && ownerStatus ? <OwnerStatus {...ownerStatus} /> : null}
        </div>
        <CardActions compact onBook={onBook} onEdit={onEdit} onPromote={onPromote} onUnpublish={onUnpublish} onPublish={onPublish} />
      </article>
    );
  }

  return (
    <article className={`listing-card ui-listing-card listing-card--${mode} list-card ${listing.promoted === 'highlight' ? 'highlighted' : ''} ${className}`.trim()} style={style} role="link" tabIndex={0} onClick={handleCardClick} onKeyDown={handleCardKeyDown}>
      <div className="list-card-top">
        <div className="list-image-wrap">
          <img src={listing.coverUrl} alt="Интерьер квартиры" onError={useFallbackImage} />
          <ListingCardBadges listing={listing} mode={mode} />
        </div>
        <div className="list-card-info">
          <div className="rating-row">
            <DescriptionText color="inherit"><Star size={14} fill="currentColor" />{listing.rating.toFixed(1).replace('.', ',')} <BadgeText as="em" weight={400} color="muted">({listing.reviewsCount})</BadgeText></DescriptionText>
            {showFavorite ? <IconButton
              className={`plain-heart ${favorite ? 'is-favorite' : ''}`}
              label={favorite ? 'Убрать из избранного' : 'В избранное'}
              size="sm"
              mode="ghost"
              tone="neutral"
              icon={<Heart size={20} fill={favorite ? 'currentColor' : 'none'} />}
              onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }}
            /> : null}
          </div>
          <BodyText as="h3" weight={500}>{cardTitle(listing.rooms)}</BodyText>
          <DescriptionText as="p" className="listing-address" truncate>{listing.address}</DescriptionText>
          <BadgeText as="p" className="listing-city" weight={400} color="secondary" truncate><MapPin size={10} />{listing.city}</BadgeText>
          <div className="list-facts">
            <BadgeText color="secondary"><Expand size={12} />{listing.area} м²</BadgeText>
            <BadgeText color="secondary"><BedDouble size={12} />{roomsLabel(listing.rooms)}</BadgeText>
            <BadgeText color="secondary"><Eye size={12} />{listing.views}</BadgeText>
          </div>
        </div>
      </div>
      {mode === 'owner' && ownerStatus ? <OwnerStatus {...ownerStatus} /> : null}
      <div className="list-card-bottom">
        <div className="price"><PageTitle as="strong">{rub(listing.price)} ₽</PageTitle><DescriptionText>/ ночь</DescriptionText></div>
        <Button size="sm" mode="ghost" tone="primary" className="open-link" endIcon={<ChevronRight size={16} />} onClick={(event) => { event.stopPropagation(); onOpen(); }}>{openLabel}</Button>
      </div>
      <CardActions onBook={onBook} onEdit={onEdit} onPromote={onPromote} onUnpublish={onUnpublish} onPublish={onPublish} />
    </article>
  );
}

export function ListingMiniCard({ className = '', ...props }: Omit<ListingCardProps, 'layout'>) {
  return <ListingCard {...props} className={`listing-mini-card ${className}`.trim()} layout="grid" />;
}

function ListingCardBadges({ listing, mode }: { listing: Listing; mode: ListingCardMode }) {
  const catalogStatus = mode === 'status' && !listing.promoted ? listing.statusBadge : undefined;
  const showOwnershipOrViewed = mode === 'status' && (listing.isOwn || listing.viewed);

  return <>
    {listing.promoted ? <PromotionBadge kind={listing.promoted} /> : null}
    {catalogStatus ? <ListingStatusBadge status={catalogStatus} /> : null}
    {showOwnershipOrViewed ? <BadgeText className={`viewed-chip ${listing.isOwn ? 'is-own' : ''}`} color="inherit">{listing.isOwn ? <Home size={11} /> : <Eye size={11} />}{listing.isOwn ? 'Ваше' : 'Просмотрено'}</BadgeText> : null}
  </>;
}

function CardActions({ compact = false, onBook, onEdit, onPromote, onUnpublish, onPublish }: { compact?: boolean; onBook?: () => void; onEdit?: () => void; onPromote?: () => void; onUnpublish?: () => void; onPublish?: () => void }) {
  if (onBook) return <div className={`listing-card-actions ${compact ? 'compact' : ''}`}><Button size="sm" mode="solid" tone="primary" className="listing-book-button" startIcon={<CalendarPlus size={compact ? 15 : 17} />} onClick={(event) => { event.stopPropagation(); onBook(); }}>Оставить заявку</Button></div>;
  if (!onEdit && !onPromote && !onUnpublish && !onPublish) return null;
  return <div className={`listing-card-actions owner ${compact ? 'compact' : ''}`}>
    {onEdit ? <Button size="sm" mode="outline" tone="neutral" startIcon={<Edit3 size={compact ? 14 : 16} />} onClick={(event) => { event.stopPropagation(); onEdit(); }}>Изменить</Button> : null}
    {onPromote ? <Button size="sm" mode="soft" tone="primary" className="promote" startIcon={<Rocket size={compact ? 14 : 16} />} onClick={(event) => { event.stopPropagation(); onPromote(); }}>Продвигать</Button> : null}
    {onUnpublish ? <Button size="sm" mode="outline" tone="neutral" aria-label="Снять с публикации" startIcon={<EyeOff size={compact ? 14 : 16} />} onClick={(event) => { event.stopPropagation(); onUnpublish(); }}>Снять</Button> : null}
    {onPublish ? <Button size="sm" mode="solid" tone="primary" className="promote" startIcon={<Send size={compact ? 14 : 16} />} onClick={(event) => { event.stopPropagation(); onPublish(); }}>Опубликовать</Button> : null}
  </div>;
}

function OwnerStatus({ label, tone, reason }: { label: string; tone: 'warning' | 'danger' | 'neutral'; reason?: string }) {
  return <div className={`listing-owner-state is-${tone}`}>
    <BadgeText color="inherit">{tone === 'danger' ? <CircleAlert size={12} /> : tone === 'warning' ? <Eye size={12} /> : <EyeOff size={12} />}{label}</BadgeText>
    {reason ? <BadgeText as="p" weight={400} color="secondary">Причина: {reason}</BadgeText> : null}
  </div>;
}

function PromotionBadge({ kind }: { kind: 'top' | 'highlight' }) {
  return <BadgeText className={`promotion-badge ${kind}`} color="inverse">{kind === 'highlight' ? <Sparkles size={11} /> : <TrendingUp size={11} />}{kind === 'highlight' ? 'ЛУЧШЕЕ' : 'ТОП'}</BadgeText>;
}
