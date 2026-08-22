import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProfilePage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Profile',
  component: ProfilePage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: { onHome: noop, onCreate: noop, onMap: noop, onMessages: noop, onBookings: noop, onFavorites: noop, onIncoming: noop, onMyListings: noop, onReviews: noop, onNotifications: noop, onSignOut: noop, onToast: noop, onTabBarHiddenChange: noop },
} satisfies Meta<typeof ProfilePage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
