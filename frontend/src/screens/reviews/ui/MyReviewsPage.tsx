import { DesktopTopbar } from '@widgets/app-navigation';
import { PullToRefreshIndicator } from '@ui';
import { useMyReviewsPageController, type ReviewsTab } from '../model/useMyReviewsPageController';
import { DeleteReviewDialog } from './DeleteReviewDialog';
import { MyReviewsContent } from './MyReviewsContent';
import '../reviews.css';

export interface MyReviewsPageProps {
  initialTab?: ReviewsTab;
  focusReviewId?: number;
  onBack: () => void;
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onEditReview: (requestId: number) => void;
  onToast: (message: string) => void;
}

export function MyReviewsPage(props: MyReviewsPageProps) {
  const controller = useMyReviewsPageController({ initialTab: props.initialTab, focusReviewId: props.focusReviewId, onToast: props.onToast });

  return (
    <div className="reviews-page my-reviews-page">
      <PullToRefreshIndicator {...controller.pullToRefresh} refreshingLabel="Обновление отзывов" />
      <DesktopTopbar active="profile" onSearch={props.onHome} onMap={props.onMap} onMessages={props.onMessages} onProfile={props.onProfile} onCreate={props.onCreate} />
      <MyReviewsContent
        tab={controller.tab}
        query={controller.query}
        sort={controller.sort}
        sortOpen={controller.sortOpen}
        writtenCount={controller.writtenCount}
        receivedCount={controller.receivedCount}
        tabPanels={controller.tabPanels}
        tabSwipeOffset={controller.tabSwipeOffset}
        tabSwipeDragging={controller.tabSwipeDragging}
        registerViewport={controller.tabScroll.registerViewport}
        registerPanel={controller.tabScroll.registerPanel}
        onBack={props.onBack}
        onQueryChange={controller.setQuery}
        onSortOpenChange={controller.setSortOpen}
        onSortChange={controller.setSort}
        onTabChange={controller.changeTab}
        onTouchStart={controller.startTabSwipe}
        onTouchMove={controller.moveTabSwipe}
        onTouchEnd={controller.finishTabSwipe}
        onTouchCancel={controller.cancelTabSwipe}
        onToast={props.onToast}
        onEditReview={props.onEditReview}
        onDeleteReview={controller.setDeleteReview}
      />
      <DeleteReviewDialog open={Boolean(controller.deleteReview)} busy={controller.deleteBusy} onClose={controller.closeDeleteDialog} onConfirm={() => void controller.confirmDelete()} />
    </div>
  );
}
