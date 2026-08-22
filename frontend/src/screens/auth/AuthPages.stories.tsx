import type { Meta, StoryObj } from '@storybook/react-vite';
import { WelcomePage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Auth/Welcome',
  component: WelcomePage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: { onPhone: noop, onEmail: noop, onGuest: noop },
} satisfies Meta<typeof WelcomePage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
