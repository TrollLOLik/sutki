import { Component, type ReactNode } from 'react';
import { BookingPage } from '@pages/booking';
import { CreateListingPage, PromotionPage } from '@pages/create-listing';
import { ListingDetailPage } from '@pages/listing-detail';
import { MapPage } from '@pages/map';
import { GuestMessagesPage, MessagesPage } from '@pages/messages';
import { MyListingsPage } from '@pages/my-listings';
import { NotificationsPage } from '@pages/notifications';
import { GuestProfilePage, ProfilePage } from '@pages/profile';
import { PublicProfilePage } from '@pages/public-profile';
import { RequestsPage } from '@pages/requests';
import { ReviewEditorPage } from '@pages/review-editor';
import { MyReviewsPage, PublicReviewsPage } from '@pages/reviews';
import { UiKitPage } from '@pages/ui-kit';
import { RouteErrorPage } from '../ui/RouteErrorPage';

export {
  BookingPage,
  CreateListingPage,
  GuestMessagesPage,
  GuestProfilePage,
  ListingDetailPage,
  MapPage,
  MessagesPage,
  MyListingsPage,
  MyReviewsPage,
  NotificationsPage,
  ProfilePage,
  PromotionPage,
  PublicProfilePage,
  PublicReviewsPage,
  RequestsPage,
  ReviewEditorPage,
  UiKitPage,
};

class RouteLoadErrorBoundary extends Component<{
  children: ReactNode;
  onBack: () => void;
  onHome: () => void;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <RouteErrorPage title="Не удалось загрузить страницу" description="Проверьте подключение и вернитесь в каталог." onBack={this.props.onBack} onHome={this.props.onHome} />;
    }
    return this.props.children;
  }
}

export function RouteScreenBoundary({ routeKey, onBack, onHome, children }: {
  routeKey: string;
  onBack: () => void;
  onHome: () => void;
  children: ReactNode;
}) {
  return (
    <RouteLoadErrorBoundary key={routeKey} onBack={onBack} onHome={onHome}>
      {children}
    </RouteLoadErrorBoundary>
  );
}
