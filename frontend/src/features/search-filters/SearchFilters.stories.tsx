import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { defaultFilters, type SearchFilters } from '@shared/types/filters';
import { DateSheet, FilterSheet, GuestSheet, SearchOverlay } from '.';

function SearchFiltersGallery({ view }: { view: 'filters' | 'search' | 'dates' | 'guests' }) {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  if (view === 'search') return <SearchOverlay open initialValue="" onClose={() => undefined} onSelect={() => undefined} onSubmit={() => undefined} />;
  if (view === 'dates') return <DateSheet checkIn={filters.checkIn} checkOut={filters.checkOut} onClose={() => undefined} onApply={(checkIn, checkOut) => setFilters((current) => ({ ...current, checkIn, checkOut }))} />;
  if (view === 'guests') return <GuestSheet value={filters.guests} onClose={() => undefined} onApply={(guests) => setFilters((current) => ({ ...current, guests }))} />;
  return <FilterSheet open value={filters} resultCount={() => 12} onClose={() => undefined} onApply={setFilters} />;
}

const meta = {
  title: 'Features/Search filters',
  component: SearchFiltersGallery,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: { view: 'filters' },
} satisfies Meta<typeof SearchFiltersGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Filters: Story = {};
export const Search: Story = { args: { view: 'search' } };
export const Dates: Story = { args: { view: 'dates' } };
export const Guests: Story = { args: { view: 'guests' } };
