import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, MoreHorizontal } from 'lucide-react';
import { AppHeader, CountedTabs, DesktopPageHeading, IconButton, SegmentedControl, Tabs } from '..';

function NavigationGallery() {
  const [segment, setSegment] = useState<'pending' | 'processed'>('pending');
  const [tab, setTab] = useState<'all' | 'unread' | 'archive'>('all');
  const [countedTab, setCountedTab] = useState<'current' | 'history'>('current');
  return <div style={{ width: 720, maxWidth: '100%', display: 'grid', gap: 24 }}>
    <div style={{ border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}><AppHeader sticky={false} title="Входящие заявки" subtitle="4 ожидают решения" onBack={() => undefined} actions={<><IconButton label="Уведомления" variant="plain" icon={<Bell size={20} />} /><IconButton label="Ещё" variant="plain" icon={<MoreHorizontal size={20} />} /></>} /></div>
    <DesktopPageHeading title="Входящие заявки" subtitle="Управляйте запросами гостей" onBack={() => undefined} />
    <SegmentedControl value={segment} onChange={setSegment} options={[{ value: 'pending', label: 'Ожидают', badge: <b>4</b> }, { value: 'processed', label: 'Обработанные' }]} />
    <Tabs value={tab} onChange={setTab} options={[{ value: 'all', label: 'Все' }, { value: 'unread', label: 'Непрочитанные', badge: 2 }, { value: 'archive', label: 'Архив' }]} />
    <CountedTabs value={countedTab} onChange={setCountedTab} ariaLabel="Заявки" items={[{ value: 'current', label: 'Текущие', count: 3 }, { value: 'history', label: 'История', count: 104 }]} />
  </div>;
}
const meta = { title: 'UI Kit/Navigation', component: NavigationGallery, tags: ['autodocs'] } satisfies Meta<typeof NavigationGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Patterns: Story = {};
