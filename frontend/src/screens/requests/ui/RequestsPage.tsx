import { DesktopTopbar } from '@widgets/app-navigation';
import { RequestDetail, RequestDialog, type RequestDirection } from '@features/requests';
import { PullToRefreshIndicator } from '@ui';
import { useRequestsPageController } from '../model/useRequestsPageController';
import { RequestsListView } from './RequestsListView';
import '../requests.css';

export interface RequestsPageProps {
  mode: RequestDirection;
  requestId: number | null;
  onOpenRequest: (mode: RequestDirection, id: number) => void;
  onBack: () => void;
  onBackToList: (mode: RequestDirection) => void;
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onOpenListing: (id: number) => void;
  onOpenChat: (id: number) => void;
  onOpenProfile: (id: string) => void;
  onRepeatBooking: (listingId: number) => void;
  onReview: (requestId: number) => void;
  onToast: (message: string) => void;
}

export function RequestsPage(props: RequestsPageProps) {
  const controller = useRequestsPageController({ mode: props.mode, requestId: props.requestId, onToast: props.onToast, onOpenRequest: props.onOpenRequest });
  const selectedRequest = controller.selectedRequest;
  const selectedPerson = selectedRequest ? (selectedRequest.direction === 'incoming' ? selectedRequest.guest : selectedRequest.listing.owner) : null;
  const selectedProfileId = selectedPerson && !selectedPerson.deleted ? selectedPerson.profileId : undefined;

  return (
    <div className="requests-page">
      <PullToRefreshIndicator {...controller.pullToRefresh} refreshingLabel="Обновление бронирований" />
      <DesktopTopbar active="profile" onSearch={props.onHome} onMap={props.onMap} onMessages={props.onMessages} onProfile={props.onProfile} onCreate={props.onCreate} />

      {selectedRequest ? (
        <RequestDetail
          request={selectedRequest}
          busy={controller.busyId === selectedRequest.id}
          onBack={() => props.onBackToList(props.mode)}
          onOpenListing={() => props.onOpenListing(selectedRequest.listing.id)}
          onOpenChat={() => props.onOpenChat(selectedRequest.chatConversationId)}
          onOpenPerson={selectedProfileId ? () => props.onOpenProfile(selectedProfileId) : undefined}
          onReview={() => props.onReview(selectedRequest.id)}
          onRepeat={() => props.onRepeatBooking(selectedRequest.listing.id)}
          onConfirm={() => controller.confirmRequest(selectedRequest)}
          onReject={() => controller.rejectRequest(selectedRequest)}
          onCancel={() => controller.cancelRequest(selectedRequest)}
        />
      ) : (
        <RequestsListView
          mode={props.mode}
          query={controller.query}
          sort={controller.sort}
          sortOpen={controller.sortOpen}
          tab={controller.tab}
          currentCount={controller.currentCount}
          historyCount={controller.historyCount}
          tabPanels={controller.tabPanels}
          busyId={controller.busyId}
          tabSwipeDragging={controller.tabSwipeDragging}
          tabSwipeOffset={controller.tabSwipeOffset}
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
          onOpenRequest={(request) => controller.openRequest(request.id)}
          onOpenChat={(request) => props.onOpenChat(request.chatConversationId)}
          onConfirm={controller.confirmRequest}
          onReject={controller.rejectRequest}
          onRepeat={(request) => props.onRepeatBooking(request.listing.id)}
          onReview={(request) => props.onReview(request.id)}
          onCancel={controller.cancelRequest}
        />
      )}

      <RequestDialog dialog={controller.dialog} reason={controller.reason} busy={controller.busyId === controller.dialog?.request.id} onReasonChange={controller.setReason} onClose={controller.closeDialog} onSubmit={controller.submitDialog} />
    </div>
  );
}
