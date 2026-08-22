import type { Meta, StoryObj } from '@storybook/react-vite';
import { listings } from '@shared/data/listings';
import { defaultFilters } from '@shared/types/filters';
import { HomePage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Home',
  component: HomePage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    query: '',
    filters: defaultFilters,
    listings,
    favorites: new Set([2]),
    activeFilters: 0,
    showingSimilar: false,
    hasSearchConstraints: false,
    onClearQuery: noop,
    onOpenSearch: noop,
    onOpenDate: noop,
    onOpenGuests: noop,
    onOpenFilters: noop,
    onToggleQuickRoom: noop,
    onToggleFavorite: noop,
    onToggleFavoritesOnly: noop,
    onOpenListing: noop,
    onBookListing: noop,
    onEditListing: noop,
    onPromoteListing: noop,
    onReset: noop,
    onNavigate: noop,
  },
} satisfies Meta<typeof HomePage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Grid: Story = { args: { initialLayout: 'grid' } };
export const SimilarResults: Story = { args: { showingSimilar: true, hasSearchConstraints: true, query: 'Центр', listings: listings.slice(0, 4) } };
export const Empty: Story = { args: { listings: [], hasSearchConstraints: true, query: 'Несуществующий адрес' } };
export const WithFilters: Story = { args: { filters: { ...defaultFilters, rooms: ['1'], guests: 2, petsAllowed: true }, activeFilters: 3 } };
