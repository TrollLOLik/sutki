import type { Meta, StoryObj } from '@storybook/react-vite';
import { requestRepository } from '@features/requests';
import { RequestsPage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Requests',
  component: RequestsPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  loaders: [async () => { requestRepository.reset(); return {}; }],
  args: {
    mode: 'incoming',
    requestId: null,
    onOpenRequest: noop,
    onBack: noop,
    onBackToList: noop,
    onHome: noop,
    onCreate: noop,
    onMap: noop,
    onMessages: noop,
    onProfile: noop,
    onOpenProfile: noop,
    onOpenListing: noop,
    onOpenChat: noop,
    onRepeatBooking: noop,
    onReview: noop,
    onToast: noop,
  },
} satisfies Meta<typeof RequestsPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Incoming: Story = {};
export const Outgoing: Story = { args: { mode: 'outgoing' } };
export const Detail: Story = { args: { mode: 'incoming', requestId: 8401 } };
