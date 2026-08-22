import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatRepository } from '@features/chat';
import { MessagesPage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Messages',
  component: MessagesPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  loaders: [async () => { chatRepository.reset(); return {}; }],
  args: {
    activeConversationId: null,
    onOpenConversation: noop,
    onBackToList: noop,
    onHome: noop,
    onCreate: noop,
    onMap: noop,
    onProfile: noop,
    onOpenProfile: noop,
    onOpenListing: noop,
    onOpenRequest: noop,
    onToast: noop,
    onTabBarHiddenChange: noop,
  },
} satisfies Meta<typeof MessagesPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ConversationList: Story = {};
export const OpenThread: Story = { args: { activeConversationId: 102 } };
