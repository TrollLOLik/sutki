import type { Meta, StoryObj } from '@storybook/react-vite';
import { notificationRepository } from '@features/notifications';
import { NotificationsPage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Notifications',
  component: NotificationsPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  loaders: [async () => { notificationRepository.reset(); return {}; }],
  args: { onBack: noop, onHome: noop, onCreate: noop, onMap: noop, onMessages: noop, onProfile: noop, onOpen: noop },
} satisfies Meta<typeof NotificationsPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};