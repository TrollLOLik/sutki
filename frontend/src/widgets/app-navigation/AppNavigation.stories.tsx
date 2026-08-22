import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CustomTabBar, DesktopTopbar, type DesktopNavigationItem } from '.';

function AppNavigationGallery() {
  const [active, setActive] = useState<DesktopNavigationItem>('search');
  const select = (item: DesktopNavigationItem) => setActive(item);

  return (
    <div style={{ minHeight: 420, width: '100%', position: 'relative', background: 'var(--screen)' }}>
      <DesktopTopbar
        active={active}
        onSearch={() => select('search')}
        onMap={() => select('map')}
        onMessages={() => select('messages')}
        onProfile={() => select('profile')}
        onCreate={() => undefined}
      />
      <div style={{ padding: 32 }}>
        <strong>Активный раздел: {active}</strong>
      </div>
      <CustomTabBar active={active} hidden={false} onChange={(value) => value !== 'create' && select(value as DesktopNavigationItem)} />
    </div>
  );
}

const meta = {
  title: 'Product/App navigation',
  component: AppNavigationGallery,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppNavigationGallery>;

export default meta;
type Story = StoryObj<typeof meta>;
export const ResponsiveNavigation: Story = {};
