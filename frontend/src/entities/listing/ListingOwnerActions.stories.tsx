import type { Meta, StoryObj } from '@storybook/react-vite';
import { ListingOwnerActions } from '.';

const meta = {
  title: 'Entities/Listing/Owner actions',
  component: ListingOwnerActions,
  tags: ['autodocs'],
  args: {
    onEdit: () => undefined,
    onPromote: () => undefined,
  },
} satisfies Meta<typeof ListingOwnerActions>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const EditOnly: Story = { args: { onPromote: undefined } };