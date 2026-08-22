import { ArrowLeft, BadgeCheck, ChevronDown, ChevronRight, CircleAlert, Eye, EyeOff, MapPin, Phone, Star } from 'lucide-react';
import type { RefObject } from 'react';
import type { Listing } from '@shared/data/listings';
import { useMediaQuery } from '@shared/lib/adaptivity';
import type { OwnerListingStatus } from '@features/my-listings';
import { BadgeText, BodyText, DescriptionText, PageTitle, Pressable, SectionTitle } from '@shared/ui';
import { ListingCard, ListingMiniCard } from '@entities/listing';
import {
  formatListingPrice,
  formatReviewsCount,
  formatRoomsCount,
  getListingDetailTitle,
  type ListingDetailFeature,
  type ListingDetailRule,
} from '../model/listingDetailView';

interface ListingDetailContentProps {
  listing: Listing;
  ownerStatus?: OwnerListingStatus;
  ownerRejectionReason?: string;
  titleRef: RefObject<HTMLDivElement | null>;
  descriptionRef: RefObject<HTMLParagraphElement | null>;
  descriptionExpanded: boolean;
  descriptionHeight: number;
  features: ListingDetailFeature[];
  rules: ListingDetailRule[];
  ownerName: string;
  ownerAvatarUrl?: string | null;
  ownerRating: number;
  ownerReviews: number;
  ownerVerified: boolean;
  ownerPhone?: string | null;
  similar: Listing[];
  favorites: ReadonlySet<number>;
  onBack: () => void;
  onOpenReviews: (listingId: number) => void;
  onToggleDescription: () => void;
  onOpenOwnerCard: () => void;
  onOpenLocation: () => void;
  onToggleListingFavorite: (listingId: number) => void;
  onOpenListing: (listingId: number) => void;
}

export function ListingDetailContent({
  listing,
  ownerStatus,
  ownerRejectionReason,
  titleRef,
  descriptionRef,
  descriptionExpanded,
  descriptionHeight,
  features,
  rules,
  ownerName,
  ownerAvatarUrl,
  ownerRating,
  ownerReviews,
  ownerVerified,
  ownerPhone,
  similar,
  favorites,
  onBack,
  onOpenReviews,
  onToggleDescription,
  onOpenOwnerCard,
  onOpenLocation,
  onToggleListingFavorite,
  onOpenListing,
}: ListingDetailContentProps) {
  const desktop = useMediaQuery('(min-width: 900px)');
  return (
    <div className="detail-content-column">
      {listing.isOwn && ownerStatus === 'unpublished' ? (
        <section className="detail-owner-status-banner is-unpublished">
          <span><EyeOff size={22} /></span>
          <div><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>Снято с публикации</BodyText><DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">Объявление не показывается в поиске. Опубликовать его снова можно в разделе «Мои объявления».</DescriptionText></div>
        </section>
      ) : null}
      {listing.isOwn && ownerStatus === 'rejected' ? (
        <section className="detail-owner-status-banner is-rejected">
          <span><CircleAlert size={22} /></span>
          <div><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>Объявление отклонено</BodyText><DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">Причина: {ownerRejectionReason || 'Проверьте данные объявления.'} Отредактируйте объявление, чтобы отправить его на повторную проверку.</DescriptionText></div>
        </section>
      ) : null}

      <section ref={titleRef} className="detail-title-block">
        <div className="detail-desktop-title-row"><Pressable aria-label="Назад" onClick={onBack}><ArrowLeft size={20} /></Pressable><PageTitle className="ui-text--inherit-metrics" color="inherit">{getListingDetailTitle(listing)}</PageTitle></div>
        <DescriptionText as="p" className="ui-text--inherit-metrics" color="secondary"><MapPin size={17} />{listing.cityName}, {listing.address}</DescriptionText>
      </section>

      <section className="detail-stat-grid">
        <Pressable onClick={() => onOpenReviews(listing.id)}>
          <span className="detail-stat-icon primary"><Star size={17} fill="currentColor" /></span>
          <span><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{listing.rating.toFixed(1).replace('.', ',')}</BodyText><DescriptionText as="small" className="ui-text--inherit-metrics" color="secondary">{formatReviewsCount(listing.reviewsCount)}</DescriptionText></span>
          <ChevronRight size={17} />
        </Pressable>
        <div>
          <span className="detail-stat-icon"><Eye size={17} /></span>
          <span><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{listing.views}</BodyText><DescriptionText as="small" className="ui-text--inherit-metrics" color="secondary">просмотров</DescriptionText></span>
        </div>
      </section>

      <section className="detail-price-mobile">
        <BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{formatListingPrice(listing.price)} ₽</BodyText><DescriptionText className="ui-text--inherit-metrics" color="inherit">/ сутки</DescriptionText>
      </section>

      <section className="detail-facts">
        <BodyText className="ui-text--inherit-metrics" color="secondary">{formatRoomsCount(listing.rooms)}</BodyText>
        <BodyText className="ui-text--inherit-metrics" color="secondary">{listing.area} м²</BodyText>
        <BodyText className="ui-text--inherit-metrics" color="secondary">до {listing.capacity} гостей</BodyText>
        <BodyText className="ui-text--inherit-metrics" color="secondary">{(listing.id % 9) + 1} этаж</BodyText>
      </section>

      <section className="detail-surface detail-description">
        <SectionTitle className="ui-text--inherit-metrics" color="inherit">Описание</SectionTitle>
        <DescriptionText as="p" ref={descriptionRef} id={`listing-description-${listing.id}`} className={`${descriptionExpanded ? 'expanded ' : ''}ui-text--inherit-metrics`} color="secondary" style={{ maxHeight: descriptionExpanded ? `${descriptionHeight}px` : '60px' }}>Уютная и светлая квартира в самом центре города. Идеальный вариант для пары, семьи или командировки. Всё необходимое для комфортного проживания уже есть: удобная кровать, просторная кухня, полностью оборудованная ванная, быстрый интернет и тихий двор. Рядом магазины, кафе, остановки общественного транспорта и основные достопримечательности.</DescriptionText>
        <Pressable className={descriptionExpanded ? 'expanded' : ''} aria-expanded={descriptionExpanded} aria-controls={`listing-description-${listing.id}`} onClick={onToggleDescription}>
          <BodyText className="ui-text--inherit-metrics" color="inherit" weight={500}>{descriptionExpanded ? 'Свернуть' : 'Подробнее'}</BodyText><ChevronDown size={17} />
        </Pressable>
      </section>

      <section className="detail-section">
        <div className="detail-section-heading"><SectionTitle className="ui-text--inherit-metrics" color="inherit">Удобства</SectionTitle><BadgeText color="inverse">{features.length}</BadgeText></div>
        <div className="detail-amenities-grid">
          {features.map(({ label, Icon }) => <div key={label}><span><Icon size={20} /></span><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{label}</BodyText></div>)}
        </div>
      </section>

      <section className="detail-section">
        <SectionTitle className="ui-text--inherit-metrics" color="inherit">Правила проживания</SectionTitle>
        <div className="detail-rules-grid">
          {rules.map(({ label, Icon }) => <div key={label}><span><Icon size={18} /></span><BodyText as="strong" className="ui-text--inherit-metrics" color="secondary" weight={500}>{label}</BodyText></div>)}
        </div>
      </section>

      <section className="detail-section detail-owner-section">
        <SectionTitle className="ui-text--inherit-metrics" color="inherit">Владелец жилья</SectionTitle>
        <Pressable className="detail-owner-card" onClick={onOpenOwnerCard}>
          <span className="detail-owner-avatar">{ownerAvatarUrl ? <img src={ownerAvatarUrl} alt="" /> : ownerName.slice(0, 1).toUpperCase()}</span>
          <span className="detail-owner-info">
            <BodyText className="detail-owner-name ui-text--inherit-metrics" color="inherit" weight={500}>{ownerName}</BodyText>
            <span className="detail-owner-rating"><BodyText as="strong" className="detail-owner-rating-value ui-text--inherit-metrics" color="inverse" weight={500}>{ownerRating.toFixed(1).replace('.', ',')}</BodyText><Star size={12} fill="currentColor" /><DescriptionText as="em" className="detail-owner-reviews ui-text--inherit-metrics" color="muted">{formatReviewsCount(ownerReviews)}</DescriptionText></span>
            <DescriptionText as="small" className="detail-owner-listings ui-text--inherit-metrics" color="secondary">1 активное объявление</DescriptionText>
          </span>
          <ChevronRight size={20} />
          <span className="detail-owner-badges">{ownerVerified ? <BadgeText as="i" className="ui-text--inherit-metrics" color="inherit"><BadgeCheck size={14} />Документы проверены</BadgeText> : null}{ownerPhone ? <BadgeText as="i" className="ui-text--inherit-metrics" color="inherit"><Phone size={14} />Телефон подтверждён</BadgeText> : null}</span>
        </Pressable>
      </section>

      {!listing.isOwn ? (
        <section className="detail-section">
          <SectionTitle className="ui-text--inherit-metrics" color="inherit">На карте</SectionTitle>
          <Pressable className="detail-map-placeholder" onClick={onOpenLocation}>
            <span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><span className="map-road road-four" />
            <span className="map-block block-one" /><span className="map-block block-two" /><span className="map-block block-three" /><span className="map-park" />
            <span className="map-pin"><MapPin size={28} fill="currentColor" /></span>
          </Pressable>
          <div className="detail-map-ai-recommendation"><DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">Дом находится на Красноармейской улице в Магнитогорске, всего в нескольких минутах ходьбы от станции и детского сада. Рядом расположены магазины и супермаркет, что делает повседневные покупки удобными.</DescriptionText></div>
        </section>
      ) : null}

      {!listing.isOwn && similar.length > 0 ? (
        <section className="detail-section detail-similar-section">
          <div className="detail-section-heading"><div><SectionTitle className="ui-text--inherit-metrics" color="inherit">Похожие варианты</SectionTitle><DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">В том же городе и близком бюджете</DescriptionText></div><BadgeText className="ui-text--inherit-metrics" color="inherit">{similar.length}</BadgeText></div>
          <div className={`listing-feed ${desktop ? 'list-layout' : 'grid-layout'} detail-similar-grid`}>
            {similar.map((item) => desktop
              ? <ListingCard key={item.id} listing={item} layout="list" mode="status" favorite={favorites.has(item.id)} onToggleFavorite={() => onToggleListingFavorite(item.id)} onOpen={() => onOpenListing(item.id)} onBook={() => onOpenListing(item.id)} />
              : <ListingMiniCard key={item.id} listing={item} mode="status" favorite={favorites.has(item.id)} onToggleFavorite={() => onToggleListingFavorite(item.id)} onOpen={() => onOpenListing(item.id)} onBook={() => onOpenListing(item.id)} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
