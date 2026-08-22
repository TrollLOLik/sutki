import { Plus } from 'lucide-react';
import { DesktopTopbar } from '@widgets/app-navigation';
import { IconButton, ListPageHeader, PullToRefreshIndicator } from '@ui';
import { useMyListingsPageController } from '../model/useMyListingsPageController';
import type { MyListingsTab } from '../model/myListingsView';
import { MyListingsControls } from './MyListingsControls';
import { MyListingsOverlays } from './MyListingsOverlays';
import { MyListingsResults } from './MyListingsResults';
import '../my-listings.css';

interface MyListingsPageProps {
  initialTab?: MyListingsTab;
  favoriteIds: ReadonlySet<number>;
  onBack: () => void;
  onCreate: () => void;
  onOpenListing: (id: number) => void;
  onEdit: (id: number) => void;
  onPromote: (id: number) => void;
  onHome: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onToast: (message: string) => void;
}

export function MyListingsPage({ initialTab = 'all', favoriteIds, onBack, onCreate, onOpenListing, onEdit, onPromote, onHome, onMap, onMessages, onProfile, onToast }: MyListingsPageProps) {
  const controller = useMyListingsPageController({ initialTab, favoriteIds, onToast });

  return (
    <div className="my-listings-screen">
      <PullToRefreshIndicator {...controller.pullToRefresh} refreshingLabel="Обновление объявлений" />
      <DesktopTopbar active="profile" onSearch={onHome} onMap={onMap} onMessages={onMessages} onProfile={onProfile} onCreate={onCreate} />
      <ListPageHeader
        presentation="mobile"
        className="my-listings-mobile-header"
        title="Мои объявления"
        onBack={onBack}
        actions={<IconButton label="Разместить объявление" mode="soft" tone="primary" icon={<Plus size={20} />} onClick={onCreate} />}
      />
      <main className="my-listings-content ui-personal-collection-layout">
        <ListPageHeader
          presentation="desktop"
          className="my-listings-desktop-heading ui-personal-collection-heading"
          title="Мои объявления"
          subtitle="Управляйте объектами, публикацией и продвижением"
          onBack={onBack}
        />
        <MyListingsControls
          query={controller.query}
          layout={controller.layout}
          activeFilterCount={controller.activeFilterCount}
          activeTab={controller.activeQuickTab}
          tabs={controller.tabs}
          onQueryChange={controller.setQuery}
          onToggleLayout={() => controller.setLayout((value) => value === 'list' ? 'grid' : 'list')}
          onOpenFilters={controller.openFilters}
          onSelectTab={controller.selectQuickStatus}
        />
        <MyListingsResults
          allItemsCount={controller.allItems.length}
          items={controller.items}
          tabPanels={controller.tabPanels}
          activeTab={controller.activeQuickTab}
          activeTabIndex={controller.activeQuickIndex}
          layout={controller.layout}
          tabSwipeOffset={controller.tabSwipeOffset}
          tabSwipeDragging={controller.tabSwipeDragging}
          registerViewport={controller.tabScroll.registerViewport}
          registerPanel={controller.tabScroll.registerPanel}
          onTouchStart={controller.startTabSwipe}
          onTouchMove={controller.moveTabSwipe}
          onTouchEnd={controller.finishTabSwipe}
          onTouchCancel={controller.cancelTabSwipe}
          onCreate={onCreate}
          onOpen={onOpenListing}
          onEdit={onEdit}
          onPromote={onPromote}
          onUnpublish={controller.setUnpublishItem}
          onPublish={controller.setPublishItem}
        />
      </main>

      <MyListingsOverlays
        filtersOpen={controller.filtersOpen}
        filters={controller.filters}
        draftStatuses={controller.draftStatuses}
        unpublishItem={controller.unpublishItem}
        publishItem={controller.publishItem}
        publicationError={controller.publicationError}
        onCloseFilters={() => controller.setFiltersOpen(false)}
        onResetStatuses={() => controller.setDraftStatuses([])}
        onToggleDraftStatus={(status) => controller.setDraftStatuses((current) => current[0] === status ? [] : [status])}
        onApplyFilters={controller.applyFilters}
        getResultCount={controller.getResultCount}
        onClosePublication={() => { controller.setUnpublishItem(null); controller.setPublishItem(null); }}
        onConfirmPublication={controller.unpublishItem ? controller.confirmUnpublish : controller.confirmPublish}
        onClosePublicationError={() => controller.setPublicationError(false)}
      />
    </div>
  );
}
