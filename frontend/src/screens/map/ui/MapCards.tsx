import { Eye, Heart, Home, Sparkles, Star, TrendingUp, X } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Listing } from '@shared/data/listings';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { ListingCard } from '@entities/listing';
import { BadgeText, BodyText, DescriptionText, Pressable, SectionTitle } from '@ui';

export function formatMapRooms(rooms: number) {
  return rooms === 0 ? 'Студия' : `${rooms}-комн.`;
}

export function MapResultCard({ listing, selected, favorite, onSelect, onOpen, onFavorite }: { listing: Listing; selected: boolean; favorite: boolean; onSelect: () => void; onOpen: () => void; onFavorite: () => void }) {
  return (
    <ListingCard
      className={`map-result-catalog-card ${selected ? 'selected' : ''}`}
      listing={listing}
      layout="list"
      mode="status"
      favorite={favorite}
      onToggleFavorite={onFavorite}
      onCardSelect={onSelect}
      onOpen={onOpen}
    />
  );
}

export function MapSelectedCard({ listing, favorite, closing, onOpen, onFavorite, onClose }: { listing: Listing; favorite: boolean; closing: boolean; onOpen: () => void; onFavorite: () => void; onClose: () => void }) {
  const desktop = useMediaQuery('(min-width: 900px)');
  const promoted = Boolean(listing.promoted);
  const highlighted = listing.promoted === 'highlight';
  const viewed = Boolean(listing.viewed && !listing.isOwn);

  const close = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClose();
  };

  if (desktop) {
    return (
      <article className={['map-selected-card', 'map-selected-card--catalog', closing ? 'is-closing' : ''].filter(Boolean).join(' ')}>
        <ListingCard
          className="map-selected-catalog-card"
          listing={listing}
          layout="list"
          mode="status"
          favorite={favorite}
          onToggleFavorite={onFavorite}
          onOpen={onOpen}
          openLabel="Подробнее"
        />
        <Pressable className="map-selected-close" aria-label="Закрыть карточку" onClick={close}><X size={17} /></Pressable>
      </article>
    );
  }

  return (
    <article className={['map-selected-card', highlighted ? 'highlighted' : '', closing ? 'is-closing' : ''].filter(Boolean).join(' ')}>
      <Pressable className="map-selected-main" aria-label={`Открыть ${listing.title}`} onClick={onOpen}>
        <img className="map-selected-image" src={listing.coverUrl} alt="" />
        <div className="map-selected-details">
          {promoted || favorite || listing.isOwn || viewed ? (
            <div className="map-selected-badges">
              {promoted ? <span className="promotion"><>{highlighted ? <Sparkles size={12} /> : <TrendingUp size={12} />}</><BadgeText as="b" className="ui-text--inherit-metrics" color="inherit">{highlighted ? 'ЛУЧШЕЕ' : 'ТОП'}</BadgeText></span> : null}
              {listing.isOwn || viewed ? <span className={listing.isOwn ? 'state own' : 'state'}>{listing.isOwn ? <Home size={11} /> : <Eye size={11} />}<BadgeText as="b" className="ui-text--inherit-metrics" color="inherit">{listing.isOwn ? 'Ваше' : 'Просмотрено'}</BadgeText></span> : null}
              {favorite ? <Heart className="favorite" size={16} fill="currentColor" /> : null}
            </div>
          ) : null}
          <div className="map-selected-price-row">
            <BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>{listing.price.toLocaleString('ru-RU')} ₽</BodyText>
            {listing.rating > 0 ? <BadgeText className="ui-text--inherit-metrics" color="inherit"><Star size={13} fill="currentColor" />{String(listing.rating).replace('.', ',')}</BadgeText> : null}
          </div>
          <SectionTitle as="h3" className="ui-text--inherit-metrics" color="inherit">{listing.title}</SectionTitle>
          <DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">{listing.address}</DescriptionText>
          <BadgeText as="small" className="ui-text--inherit-metrics" color="inherit">{formatMapRooms(listing.rooms)} · {listing.area} м² <Eye size={13} />{listing.views}</BadgeText>
        </div>
      </Pressable>
      <Pressable className="map-selected-close" aria-label="Закрыть карточку" onClick={close}><X size={17} /></Pressable>
    </article>
  );
}
