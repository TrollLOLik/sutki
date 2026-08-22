import { Grid2X2, List, SlidersHorizontal } from 'lucide-react';
import type { ListingLayoutMode } from '@entities/listing';
import { BadgeText, CountedTabs, IconButton, PersonalListToolbar } from '@ui';
import type { MyListingsTab } from '../model/myListingsView';

interface MyListingsControlsProps {
  query: string;
  layout: ListingLayoutMode;
  activeFilterCount: number;
  activeTab: MyListingsTab | 'custom';
  tabs: Array<{ value: MyListingsTab; label: string; count: number }>;
  onQueryChange: (query: string) => void;
  onToggleLayout: () => void;
  onOpenFilters: () => void;
  onSelectTab: (tab: MyListingsTab) => void;
}

export function MyListingsControls({ query, layout, activeFilterCount, activeTab, tabs, onQueryChange, onToggleLayout, onOpenFilters, onSelectTab }: MyListingsControlsProps) {
  return (
    <section className="my-listings-controls ui-personal-collection-controls">
      <PersonalListToolbar
        className="ui-list-search-toolbar my-listings-toolbar"
        query={query}
        onQueryChange={onQueryChange}
        placeholder="Адрес, город или описание"
        actions={<>
          <IconButton label={layout === 'list' ? 'Показать сеткой' : 'Показать списком'} icon={layout === 'list' ? <Grid2X2 size={19} /> : <List size={19} />} onClick={onToggleLayout} />
          <div className="my-listings-filter-trigger">
            <IconButton label="Фильтры" icon={<SlidersHorizontal size={19} />} onClick={onOpenFilters} />
            {activeFilterCount > 0 ? <BadgeText color="inverse">{activeFilterCount}</BadgeText> : null}
          </div>
        </>}
      />
      <CountedTabs<MyListingsTab | 'custom'> mode="list" animatedIndicator semantic="filter" ariaLabel="Статус объявлений" value={activeTab} onChange={(value) => { if (value !== 'custom') onSelectTab(value); }} items={tabs} />
    </section>
  );
}
