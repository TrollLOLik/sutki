import type { Meta, StoryObj } from '@storybook/react-vite';
import { CreateListingPage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Create listing',
  component: CreateListingPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: { onClose: noop, onOpenMyListings: noop, onPromote: noop, onPublished: noop, onHome: noop, onMap: noop, onMessages: noop, onProfile: noop, onCreate: noop },
} satisfies Meta<typeof CreateListingPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Wizard: Story = {};
