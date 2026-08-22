import { ArrowDown, ArrowUp, MessageSquareText, Star, StarHalf } from 'lucide-react';
import type { TouchEventHandler } from 'react';
import { isReviewEditable, type Review, type ReviewSort } from '@features/reviews';
import { BadgeText, CountedTabs, EmptyState, ListPageHeader, PersonalCollectionGrid, PersonalListToolbar } from '@ui';
import type { ReviewsTab } from '../model/useMyReviewsPageController';
import { ReviewCard } from './ReviewCard';

const sorts: Array<{ id: ReviewSort; label: string; icon: typeof ArrowDown }> = [
  { id: 'newest', label: 'Сначала новые', icon: ArrowDown },
  { id: 'oldest', label: 'Сначала старые', icon: ArrowUp },
  { id: 'rating_desc', label: 'Сначала с высокой оценкой', icon: Star },
  { id: 'rating_asc', label: 'Сначала с низкой оценкой', icon: StarHalf },
];

interface MyReviewsContentProps {
  tab: ReviewsTab;
  query: string;
  sort: ReviewSort;
  sortOpen: boolean;
  writtenCount: number;
  receivedCount: number;
  tabPanels: Array<{ tab: ReviewsTab; rawCount: number; items: Review[] }>;
  tabSwipeOffset: number;
  tabSwipeDragging: boolean;
  registerViewport: (node: HTMLElement | null) => void;
  registerPanel: (tab: ReviewsTab, node: HTMLElement | null) => void;
  onBack: () => void;
  onQueryChange: (query: string) => void;
  onSortOpenChange: (open: boolean) => void;
  onSortChange: (sort: ReviewSort) => void;
  onTabChange: (tab: ReviewsTab) => void;
  onTouchStart: TouchEventHandler<HTMLDivElement>;
  onTouchMove: TouchEventHandler<HTMLDivElement>;
  onTouchEnd: TouchEventHandler<HTMLDivElement>;
  onTouchCancel: () => void;
  onToast: (message: string) => void;
  onEditReview: (requestId: number) => void;
  onDeleteReview: (review: Review) => void;
}

export function MyReviewsContent(props: MyReviewsContentProps) {
  return (
    <>
      <ListPageHeader presentation="mobile" className="reviews-app-header" title="Мои отзывы" onBack={props.onBack} />
      <main className="reviews-main ui-personal-collection-layout">
        <ListPageHeader presentation="desktop" className="ui-personal-collection-heading" title="Мои отзывы" subtitle="Ваши оценки и отзывы гостей" onBack={props.onBack} />
        <div className="reviews-sticky-controls ui-personal-collection-controls">
          <PersonalListToolbar
            className="ui-list-search-toolbar reviews-toolbar"
            query={props.query}
            onQueryChange={props.onQueryChange}
            placeholder="Текст, адрес или пользователь"
            sort={props.sort}
            sortOpen={props.sortOpen}
            onSortOpenChange={props.onSortOpenChange}
            onSortChange={props.onSortChange}
            sortOptions={sorts.map((item) => { const Icon = item.icon; return { value: item.id, label: item.label, icon: <Icon size={18} /> }; })}
          />
          <CountedTabs mode="list" animatedIndicator className="reviews-tabs" value={props.tab} ariaLabel="Тип отзывов" items={[{ value: 'written', label: 'Оставленные', count: props.writtenCount, panelId: 'reviews-written-panel' }, { value: 'received', label: 'Полученные', count: props.receivedCount, panelId: 'reviews-received-panel' }]} onChange={props.onTabChange} />
        </div>

        <div className="reviews-tab-viewport ui-personal-collection-tab-viewport" ref={props.registerViewport} onTouchStart={props.onTouchStart} onTouchMove={props.onTouchMove} onTouchEnd={props.onTouchEnd} onTouchCancel={props.onTouchCancel}>
          <div className={`reviews-tab-track ui-personal-collection-tab-track ${props.tabSwipeDragging ? 'is-dragging' : ''}`} style={{ transform: `translate3d(calc(${props.tab === 'received' ? '-50%' : '0%'} + ${props.tabSwipeOffset}px), 0, 0)` }}>
            {props.tabPanels.map((panel) => (
              <section ref={(node) => { props.registerPanel(panel.tab, node); if (node) node.inert = props.tab !== panel.tab; }} id={`reviews-${panel.tab}-panel`} role="tabpanel" aria-hidden={props.tab !== panel.tab} className="reviews-tab-panel ui-personal-collection-tab-panel" key={panel.tab}>
                {panel.items.length ? (
                  <>
                    <PersonalCollectionGrid className="reviews-grid">
                      {panel.items.map((review) => (
                        <div className="ui-personal-collection-item" id={`review-${review.id}`} key={review.id}>
                          <ReviewCard review={review} mode={panel.tab} onToast={props.onToast} onEdit={panel.tab === 'written' && review.requestId && isReviewEditable(review) ? () => props.onEditReview(review.requestId!) : undefined} onDelete={panel.tab === 'written' && review.status !== 'deleted' ? () => props.onDeleteReview(review) : undefined} />
                        </div>
                      ))}
                    </PersonalCollectionGrid>
                    <BadgeText as="p" className="reviews-list-end" color="muted">Это все отзывы</BadgeText>
                  </>
                ) : (
                  <EmptyState
                    className="reviews-empty"
                    icon={<MessageSquareText size={24} />}
                    title={panel.rawCount ? 'Ничего не найдено' : panel.tab === 'written' ? 'Вы ещё не оставляли отзывы' : 'У вас ещё нет полученных отзывов'}
                    description={panel.rawCount ? 'Попробуйте изменить поисковый запрос.' : panel.tab === 'written' ? 'Здесь появятся ваши оценки после завершённых поездок.' : 'Здесь появятся отзывы гостей о ваших объявлениях.'}
                  />
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
