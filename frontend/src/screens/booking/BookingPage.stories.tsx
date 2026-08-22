import type { Meta, StoryObj } from '@storybook/react-vite';
import { listings } from '@shared/data/listings';
import { BookingPage } from '.';

const noop = () => undefined;
const meta = {
  title: 'Pages/Booking',
  component: BookingPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    listing: listings[0],
    onBack: noop,
    onHome: noop,
    onMap: noop,
    onMessages: noop,
    onProfile: noop,
    onCreate: noop,
    onOpenBookings: noop,
    onRequireAuth: noop,
    initialCheckIn: '2026-08-14',
    initialCheckOut: '2026-08-18',
    initialGuests: 2,
  },
} satisfies Meta<typeof BookingPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FilledDates: Story = {};
export const Empty: Story = { args: { initialCheckIn: null, initialCheckOut: null, initialGuests: 1 } };
