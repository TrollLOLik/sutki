import type { Meta, StoryObj } from '@storybook/react-vite';
import { MyListingsPage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/MyListings',
  component: MyListingsPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: { favoriteIds: new Set<number>(), onBack: noop, onCreate: noop, onOpenListing: noop, onEdit: noop, onPromote: noop, onHome: noop, onMap: noop, onMessages: noop, onProfile: noop, onToast: noop },
} satisfies Meta<typeof MyListingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
