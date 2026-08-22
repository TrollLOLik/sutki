import type { Meta, StoryObj } from '@storybook/react-vite';
import { listings } from '@shared/data/listings';
import { ListingDetailPage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Listing detail',
  component: ListingDetailPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    listing: listings[0],
    favorite: false,
    favorites: new Set<number>(),
    onToggleFavorite: noop,
    onToggleListingFavorite: noop,
    onBack: noop,
    onHome: noop,
    onMap: noop,
    onMessages: noop,
    onProfile: noop,
    onCreate: noop,
    onOpenListing: noop,
    onOpenOwner: noop,
    onOpenReviews: noop,
    onEdit: noop,
    onPromote: noop,
    onBook: noop,
    onToast: noop,
  },
} satisfies Meta<typeof ListingDetailPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Favorite: Story = { args: { favorite: true } };
