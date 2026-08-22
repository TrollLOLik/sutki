import { Home, Search } from 'lucide-react';
import type { TouchEventHandler } from 'react';
import type { ListingLayoutMode } from '@entities/listing';
import type { OwnerListing } from '@features/my-listings';
import { EmptyState, PersonalCollectionGrid } from '@ui';
import type { MyListingsTab } from '../model/myListingsView';
import { OwnerListingCard } from './OwnerListingCard';

interface MyListingsResultsProps {
  allItemsCount: number;
  items: OwnerListing[];
  tabPanels: Array<{ tab: MyListingsTab; items: OwnerListing[] }>;
  activeTab: MyListingsTab | 'custom';
  activeTabIndex: number;
  layout: ListingLayoutMode;
  tabSwipeOffset: number;
  tabSwipeDragging: boolean;
  registerViewport: (node: HTMLElement | null) => void;
  registerPanel: (tab: MyListingsTab | 'custom', node: HTMLElement | null) => void;
  onTouchStart: TouchEventHandler<HTMLDivElement>;
  onTouchMove: TouchEventHandler<HTMLDivElement>;
  onTouchEnd: TouchEventHandler<HTMLDivElement>;
  onTouchCancel: () => void;
  onCreate: () => void;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onPromote: (id: number) => void;
  onUnpublish: (item: OwnerListing) => void;
  onPublish: (item: OwnerListing) => void;
}

function OwnerFeed({ items, layout, onOpen, onEdit, onPromote, onUnpublish, onPublish }: Pick<MyListingsResultsProps, 'items' | 'layout' | 'onOpen' | 'onEdit' | 'onPromote' | 'onUnpublish' | 'onPublish'>) {
  return (
    <PersonalCollectionGrid className={`my-listings-feed ${layout === 'grid' ? 'grid-layout' : 'list-layout'}`}>
      {items.map((item) => (
        <OwnerListingCard
          key={item.listing.id}
          item={item}
          layout={layout}
          onOpen={() => onOpen(item.listing.id)}
          onEdit={() => onEdit(item.listing.id)}
          onPromote={() => onPromote(item.listing.id)}
          onUnpublish={() => onUnpublish(item)}
          onPublish={() => onPublish(item)}
        />
      ))}
    </PersonalCollectionGrid>
  );
}

export function MyListingsResults(props: MyListingsResultsProps) {
  if (props.allItemsCount === 0) {
    return <EmptyState icon={<Home size={30} />} title="Пока нет объявлений" description="Разместите своё первое жильё — это займёт пару минут." actionLabel="Разместить объявление" onAction={props.onCreate} />;
  }

  if (props.activeTab === 'custom') {
    return props.items.length
      ? <OwnerFeed items={props.items} layout={props.layout} onOpen={props.onOpen} onEdit={props.onEdit} onPromote={props.onPromote} onUnpublish={props.onUnpublish} onPublish={props.onPublish} />
      : <EmptyState icon={<Search size={28} />} title="Ничего не найдено" description="Измените запрос или сбросьте фильтры." />;
  }

  return (
    <div ref={props.registerViewport} className="my-listings-tab-viewport ui-personal-collection-tab-viewport" onTouchStart={props.onTouchStart} onTouchMove={props.onTouchMove} onTouchEnd={props.onTouchEnd} onTouchCancel={props.onTouchCancel}>
      <div className={`my-listings-tab-track ui-personal-collection-tab-track ${props.tabSwipeDragging ? 'is-dragging' : ''}`} style={{ transform: `translate3d(calc(-${props.activeTabIndex * 20}% + ${props.tabSwipeOffset}px), 0, 0)` }}>
        {props.tabPanels.map((panel) => (
          <div ref={(node) => { props.registerPanel(panel.tab, node); if (node) node.inert = props.activeTab !== panel.tab; }} aria-hidden={props.activeTab !== panel.tab} className="my-listings-tab-panel ui-personal-collection-tab-panel" key={panel.tab}>
            {panel.items.length
              ? <OwnerFeed items={panel.items} layout={props.layout} onOpen={props.onOpen} onEdit={props.onEdit} onPromote={props.onPromote} onUnpublish={props.onUnpublish} onPublish={props.onPublish} />
              : <EmptyState icon={<Search size={28} />} title="Ничего не найдено" description="В этом разделе пока нет объявлений." />}
          </div>
        ))}
      </div>
    </div>
  );
}
