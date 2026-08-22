import { ArrowDown, ArrowUp, CalendarDays, Clock3 } from 'lucide-react';
import type { TouchEventHandler } from 'react';
import {
  RequestCard,
  RequestsEmpty,
  type RentalRequest,
  type RequestDirection,
  type RequestSort,
  type RequestTab,
} from '@features/requests';
import { BadgeText, CountedTabs, ListPageHeader, PersonalCollectionGrid, PersonalListToolbar } from '@ui';

const sortOptions: Array<{ id: RequestSort; label: string; icon: typeof ArrowDown }> = [
  { id: 'newest', label: 'Сначала новые заявки', icon: ArrowDown },
  { id: 'oldest', label: 'Сначала старые заявки', icon: ArrowUp },
  { id: 'checkin_asc', label: 'Ближайшее заселение', icon: CalendarDays },
  { id: 'checkin_desc', label: 'Позднее заселение', icon: Clock3 },
];

interface RequestsListViewProps {
  mode: RequestDirection;
  query: string;
  sort: RequestSort;
  sortOpen: boolean;
  tab: RequestTab;
  currentCount: number;
  historyCount: number;
  tabPanels: Array<{ tab: RequestTab; items: RentalRequest[] }>;
  busyId: number | null;
  tabSwipeDragging: boolean;
  tabSwipeOffset: number;
  registerViewport: (node: HTMLElement | null) => void;
  registerPanel: (tab: RequestTab, node: HTMLElement | null) => void;
  onBack: () => void;
  onQueryChange: (query: string) => void;
  onSortOpenChange: (open: boolean) => void;
  onSortChange: (sort: RequestSort) => void;
  onTabChange: (tab: RequestTab) => void;
  onTouchStart: TouchEventHandler<HTMLDivElement>;
  onTouchMove: TouchEventHandler<HTMLDivElement>;
  onTouchEnd: TouchEventHandler<HTMLDivElement>;
  onTouchCancel: () => void;
  onOpenRequest: (request: RentalRequest) => void;
  onOpenChat: (request: RentalRequest) => void;
  onConfirm: (request: RentalRequest) => void;
  onReject: (request: RentalRequest) => void;
  onRepeat: (request: RentalRequest) => void;
  onReview: (request: RentalRequest) => void;
  onCancel: (request: RentalRequest) => void;
}

export function RequestsListView(props: RequestsListViewProps) {
  const title = props.mode === 'incoming' ? 'Входящие заявки' : 'Мои брони';

  return (
    <main className="requests-list-page ui-personal-collection-layout">
      <ListPageHeader presentation="mobile" className="requests-mobile-header" title={title} onBack={props.onBack} />
      <ListPageHeader presentation="desktop" className="ui-personal-collection-heading" title={title} subtitle={props.mode === 'incoming' ? 'Управляйте запросами гостей' : 'Следите за статусом своих заявок'} onBack={props.onBack} />

      <div className="requests-list-controls ui-personal-collection-controls">
        <PersonalListToolbar
          className="ui-list-search-toolbar requests-toolbar"
          query={props.query}
          onQueryChange={props.onQueryChange}
          placeholder={props.mode === 'incoming' ? 'Гость, телефон или адрес' : 'Адрес, город или владелец'}
          sort={props.sort}
          sortOpen={props.sortOpen}
          onSortOpenChange={props.onSortOpenChange}
          onSortChange={props.onSortChange}
          sortOptions={sortOptions.map((option) => { const Icon = option.icon; return { value: option.id, label: option.label, icon: <Icon size={18} /> }; })}
        />
        <CountedTabs mode="list" animatedIndicator className="requests-segmented" value={props.tab} ariaLabel="Состояние заявок" items={[{ value: 'current', label: props.mode === 'incoming' ? 'Ожидают' : 'Активные', count: props.currentCount, panelId: 'requests-current-panel' }, { value: 'history', label: props.mode === 'incoming' ? 'Обработанные' : 'История', count: props.historyCount, panelId: 'requests-history-panel' }]} onChange={props.onTabChange} />
      </div>

      <div className="requests-tab-viewport ui-personal-collection-tab-viewport" ref={props.registerViewport} onTouchStart={props.onTouchStart} onTouchMove={props.onTouchMove} onTouchEnd={props.onTouchEnd} onTouchCancel={props.onTouchCancel}>
        <div className={`requests-tab-track ui-personal-collection-tab-track ${props.tabSwipeDragging ? 'is-dragging' : ''}`} style={{ transform: `translate3d(calc(${props.tab === 'history' ? '-50%' : '0%'} + ${props.tabSwipeOffset}px), 0, 0)` }}>
          {props.tabPanels.map((panel) => (
            <PersonalCollectionGrid ref={(node) => { props.registerPanel(panel.tab, node); if (node) node.inert = props.tab !== panel.tab; }} id={`requests-${panel.tab}-panel`} role="tabpanel" aria-hidden={props.tab !== panel.tab} className="requests-card-list requests-tab-panel ui-personal-collection-tab-panel" key={panel.tab}>
              {panel.items.length ? panel.items.map((item) => (
                <RequestCard
                  key={item.id}
                  request={item}
                  history={panel.tab === 'history'}
                  busy={props.busyId === item.id}
                  onOpen={() => props.onOpenRequest(item)}
                  onChat={() => props.onOpenChat(item)}
                  onConfirm={() => props.onConfirm(item)}
                  onReject={() => props.onReject(item)}
                  onRepeat={() => props.onRepeat(item)}
                  onReview={() => props.onReview(item)}
                  onCancel={() => props.onCancel(item)}
                />
              )) : <RequestsEmpty mode={props.mode} tab={panel.tab} query={props.query} />}
              {panel.items.length ? <BadgeText as="p" className="requests-list-end" color="muted">Это все {panel.tab === 'current' ? (props.mode === 'incoming' ? 'ожидающие заявки' : 'активные брони') : 'записи'}</BadgeText> : null}
            </PersonalCollectionGrid>
          ))}
        </div>
      </div>
    </main>
  );
}
