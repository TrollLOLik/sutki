import type { Meta, StoryObj } from '@storybook/react-vite';
import { UiKitPage } from '.';

const meta = {
  title: 'Pages/UI Kit catalogue',
  component: UiKitPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: { onBack: () => undefined },
} satisfies Meta<typeof UiKitPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Catalogue: Story = {};
