import { MessageSquareText, Star } from 'lucide-react';
import { useMemo } from 'react';
import { ReviewRating, reviewSummary, useReviewsSnapshot } from '@features/reviews';
import { useMyListingsSnapshot } from '@features/my-listings';
import { listings } from '@shared/data/listings';
import { usePullToRefresh } from '@shared/lib/scroll/usePullToRefresh';
import {
  BadgeText,
  Button,
  EmptyState,
  HeroTitle,
  ListPageHeader,
  Progress,
  PullToRefreshIndicator,
  RouteActionBarPortal,
  Surface,
} from '@ui';
import { DesktopTopbar } from '@widgets/app-navigation';
import { ReviewCard } from './ReviewCard';
import '../reviews.css';

export interface PublicReviewsPageProps {
  kind: 'listing' | 'user';
  subjectId: string;
  onBack: () => void;
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onBookListing: (listingId: number) => void;
  onEditListing: (listingId: number) => void;
  onToast: (message: string) => void;
}

function reviewCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} отзывов`;
  if (last === 1) return `${count} отзыв`;
  if (last >= 2 && last <= 4) return `${count} отзыва`;
  return `${count} отзывов`;
}

export function PublicReviewsPage(props: PublicReviewsPageProps) {
  const { reviews } = useReviewsSnapshot();
  const ownerListings = useMyListingsSnapshot();
  const pullToRefresh = usePullToRefresh();
  const visible = useMemo(
    () => reviews.filter((review) => review.status === 'active' && (
      props.kind === 'listing'
        ? review.listing.id === Number(props.subjectId)
        : review.listing.ownerId === props.subjectId
    )),
    [props.kind, props.subjectId, reviews],
  );
  const summary = reviewSummary(visible);
  const listing = props.kind === 'listing'
    ? ownerListings.find((item) => item.listing.id === Number(props.subjectId))?.listing
      ?? listings.find((item) => item.id === Number(props.subjectId))
    : undefined;
  const maxDistribution = Math.max(1, ...summary.distribution);

  return (
    <div className="reviews-page public-reviews-page">
      <PullToRefreshIndicator {...pullToRefresh} refreshingLabel="Обновление отзывов" />
      <DesktopTopbar
        active="search"
        onSearch={props.onHome}
        onMap={props.onMap}
        onMessages={props.onMessages}
        onProfile={props.onProfile}
        onCreate={props.onCreate}
      />
      <ListPageHeader presentation="mobile" className="reviews-app-header" title="Отзывы" onBack={props.onBack} />
      <main className="reviews-main public-reviews-main">
        <ListPageHeader presentation="desktop" title="Отзывы" onBack={props.onBack} />
        {visible.length ? (
          <>
            <Surface level="raised" radius="xl" className="reviews-summary">
              <div className="reviews-average">
                <HeroTitle as="strong">{summary.average.toFixed(1).replace('.', ',')}</HeroTitle>
                <ReviewRating value={summary.average} size="sm" label="Средняя оценка" />
                <BadgeText color="muted">{reviewCountLabel(summary.total)}</BadgeText>
              </div>
              <div className="reviews-distribution">
                {[5, 4, 3, 2, 1].map((rating, index) => (
                  <div key={rating}>
                    <BadgeText color="secondary">{rating}</BadgeText>
                    <Star size={9} fill="currentColor" aria-hidden="true" />
                    <Progress value={summary.distribution[index]} max={maxDistribution} label={`Оценка ${rating}: ${summary.distribution[index]}`} />
                    <BadgeText color="muted">{summary.distribution[index]}</BadgeText>
                  </div>
                ))}
              </div>
            </Surface>
            <div className="reviews-grid">
              {visible.map((review) => <ReviewCard key={review.id} review={review} mode="public" onToast={props.onToast} />)}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<MessageSquareText size={24} />}
            title="Отзывов пока нет"
            description="Будьте первым, кто оставит отзыв об этом объекте."
          />
        )}
      </main>
      {listing ? (
        <RouteActionBarPortal contextClassName="reviews-page public-reviews-page">
          <footer className="public-reviews-footer">
            <Button size="md" mode="solid" tone="primary" stretched onClick={() => listing.isOwn ? props.onEditListing(listing.id) : props.onBookListing(listing.id)}>
              {listing.isOwn ? 'Редактировать' : 'Оставить заявку'}
            </Button>
          </footer>
        </RouteActionBarPortal>
      ) : null}
    </div>
  );
}
