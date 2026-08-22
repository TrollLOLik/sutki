import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { Button, Chip, IconButton } from '..';

function ActionsGallery() {
  return <div style={{ width: 620, maxWidth: '100%', display: 'grid', gap: 24 }}>
    <section><h3>Размеры</h3><div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}><Button mode="solid" tone="primary" size="sm" startIcon={<Plus />}>Small · 40</Button><Button mode="solid" tone="primary" size="md" startIcon={<Plus />}>Medium · 44</Button><Button mode="solid" tone="primary" size="lg" startIcon={<Plus />}>Large · 48</Button></div></section>
    <section><h3>Режимы</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><Button mode="solid" tone="primary">Фоновая</Button><Button mode="outline" tone="primary">Окантовка</Button><Button mode="soft" tone="primary">Мягкая</Button><Button mode="ghost" tone="primary">Без фона</Button><Button mode="solid" tone="primary" loading>Сохраняем</Button></div></section>
    <section><h3>Цвет задаётся отдельно</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><Button mode="solid" tone="neutral">Нейтральная</Button><Button mode="solid" tone="success">Принять</Button><Button mode="outline" tone="danger" startIcon={<Trash2 />}>Удалить</Button><Button mode="soft" tone="warning">Внимание</Button></div></section>
    <section><h3>Круглые кнопки</h3><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><IconButton label="Избранное" size="sm" mode="ghost" tone="neutral" icon={<Heart />} /><IconButton label="Добавить" size="md" mode="solid" tone="primary" icon={<Plus />} /><IconButton label="Удалить" size="lg" mode="soft" tone="danger" icon={<Trash2 />} /></div></section>
    <section><h3>Старые варианты совместимы</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><Button>Основная</Button><Button variant="secondary">Вторичная</Button><Button variant="tertiary">Текстовая</Button><Button variant="success">Принять</Button><Button variant="danger">Удалить</Button></div></section>
    <section><h3>Чипы</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Chip>Студия</Chip><Chip selected>1 комната</Chip><Chip removable onRemove={() => undefined}>Wi‑Fi</Chip></div></section>
  </div>;
}
const meta = { title: 'UI Kit/Actions', component: ActionsGallery, tags: ['autodocs'] } satisfies Meta<typeof ActionsGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AllStates: Story = {};
