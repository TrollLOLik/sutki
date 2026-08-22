import type { Meta, StoryObj } from '@storybook/react-vite';
import { listings } from '@shared/data/listings';
import { defaultFilters } from '@shared/types/filters';
import { MapPage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Map',
  component: MapPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    listings,
    filters: defaultFilters,
    query: '',
    activeFilters: 0,
    favorites: new Set([1]),
    onToggleFavorite: noop,
    onOpenListing: noop,
    onOpenSearch: noop,
    onClearLocation: noop,
    onOpenFilters: noop,
    onHome: noop,
    onCreate: noop,
    onMessages: noop,
    onProfile: noop,
  },
} satisfies Meta<typeof MapPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PlaceholderMap: Story = {};
