import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatRepository } from '@features/chat';
import { PublicProfilePage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Public profile',
  component: PublicProfilePage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  loaders: [async () => { chatRepository.reset(); return {}; }],
  args: {
    userId: 'anna',
    onBack: noop,
    onHome: noop,
    onCreate: noop,
    onMap: noop,
    onMessages: noop,
    onProfile: noop,
    onOpenConversation: noop,
    onOpenListing: noop,
    onBookListing: noop,
    favorites: new Set<number>(),
    onToggleFavorite: noop,
    onOpenReviews: noop,
    onToast: noop,
  },
} satisfies Meta<typeof PublicProfilePage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const MissingProfile: Story = { args: { userId: 'missing-user' } };
