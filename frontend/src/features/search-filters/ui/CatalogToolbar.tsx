import { CalendarDays, ChevronDown, Heart, Search, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { ListingLayoutToggle, type ListingLayoutMode } from '@entities/listing';
import { BadgeText, BodyText, Button, Chip, DescriptionText, IconButton, ScrollArea } from '@ui';
import { formatDateRange, formatGuests, quickRoomOptions, type RoomFilter, type SearchFilters } from '@shared/types/filters';

export interface CatalogToolbarProps {
  searchLabel: string;
  searchPlaceholder?: string;
  layout: ListingLayoutMode;
  activeFilters: number;
  onOpenSearch: () => void;
  onClearSearch: () => void;
  onToggleLayout: () => void;
  onOpenFilters: () => void;
}

export function CatalogToolbar({ searchLabel, searchPlaceholder = 'Город, адрес или название', layout, activeFilters, onOpenSearch, onClearSearch, onToggleLayout, onOpenFilters }: CatalogToolbarProps) {
  return (
    <div className="main-control-row">
      <div className="search-pill">
        <Button className="search-pill-main" size="md" mode="ghost" tone="neutral" startIcon={<Search size={20} />} onClick={onOpenSearch}><BodyText color="inherit" truncate className={searchLabel ? 'has-value' : ''}>{searchLabel || searchPlaceholder}</BodyText></Button>
        {searchLabel ? <IconButton className="search-pill-clear" label="Очистить" size="sm" variant="plain" icon={<X size={17} />} onClick={(event) => { event.stopPropagation(); onClearSearch(); }} /> : null}
      </div>
      <ListingLayoutToggle mode={layout} onToggle={onToggleLayout} />
      <IconButton className="circle-control" label="Фильтры" size="md" variant="surface" icon={<><SlidersHorizontal size={22} />{activeFilters > 0 ? <BadgeText color="inverse" className="filter-count-badge">{activeFilters}</BadgeText> : null}</>} onClick={onOpenFilters} />
    </div>
  );
}

export interface CatalogFilterShortcutsProps {
  filters: SearchFilters;
  onToggleQuickRoom: (value: 'all' | RoomFilter) => void;
  onOpenDate: () => void;
  onOpenGuests: () => void;
  onToggleFavoritesOnly: () => void;
}

export function CatalogFilterShortcuts({ filters, onToggleQuickRoom, onOpenDate, onOpenGuests, onToggleFavoritesOnly }: CatalogFilterShortcutsProps) {
  return (
    <div className="collapsible-filters">
      <ScrollArea className="quick-filter-scroll" axis="horizontal" ariaLabel="Быстрые фильтры по комнатам">
        <div className="quick-filter-content">
          {quickRoomOptions.map((item) => {
            const selected = item.value === 'all' ? filters.rooms.length === 0 : filters.rooms.includes(item.value);
            return <Chip key={item.value} selected={selected} aria-pressed={selected} onClick={(event) => { onToggleQuickRoom(item.value); event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }}>{item.label}</Chip>;
          })}
        </div>
      </ScrollArea>
      <div className="secondary-controls">
        <Button size="md" mode="soft" tone="neutral" startIcon={<CalendarDays size={18} />} endIcon={<ChevronDown size={16} />} onClick={onOpenDate}><DescriptionText color="inherit" truncate>{formatDateRange(filters.checkIn, filters.checkOut)}</DescriptionText></Button>
        <Button size="md" mode="soft" tone="neutral" startIcon={<UserRound size={18} />} endIcon={<ChevronDown size={16} />} onClick={onOpenGuests}><DescriptionText color="inherit" truncate>{formatGuests(filters.guests)}</DescriptionText></Button>
        <IconButton className={`favorite-filter ${filters.favoritesOnly ? 'selected' : ''}`} label="Только избранное" size="md" variant="surface" icon={<Heart size={22} fill={filters.favoritesOnly ? 'currentColor' : 'none'} />} onClick={onToggleFavoritesOnly} />
      </div>
    </div>
  );
}
