import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarDays, Home, MessageCircle } from 'lucide-react';
import { Avatar, Badge, ChoiceCard, Divider, IconValueRow, InlineAlert, KeyValueRow, ListCell, Pressable, Skeleton, Stat, Surface } from '..';

function DataDisplayGallery() {
  return <div style={{ width: 620, maxWidth: '100%', display: 'grid', gap: 20 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Badge tone="primary">На рассмотрении</Badge><Badge tone="success">Подтверждена</Badge><Badge tone="warning">Нужна проверка</Badge><Badge tone="danger">Отклонена</Badge><Badge tone="info">Новое</Badge></div>
    <div style={{ display: 'flex', gap: 14 }}><Avatar name="Анна Смирнова" size="lg" online verified /><Avatar name="Иван Петров" size="lg" src="/chat/avatars/anna.svg" /></div>
    <Surface radius="xl"><ListCell before={<Home size={19} />} title="Мои объявления" subtitle="3 активных объявления" /><Divider inset /><ListCell before={<CalendarDays size={19} />} title="Входящие заявки" after={<Badge tone="danger">4</Badge>} /><ListCell before={<MessageCircle size={19} />} title="Сообщения" subtitle="2 непрочитанных" /></Surface>
    <Surface radius="xl" style={{ padding: '4px 16px' }}><KeyValueRow label="Версия" value="1.0.0" /><KeyValueRow label="Поддержка" value="support@domryadom.ru" valueColor="accent" /></Surface>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}><Stat icon={<Home />} value="12" label="Объявлений" wrapIcon /><Stat icon={<MessageCircle />} value="7 мин" label="Время ответа" wrapIcon /></div>
    <IconValueRow icon={<CalendarDays />} label="Заезд и выезд" value="13–17 августа" />
    <Pressable style={{ padding: 14, borderRadius: 16, background: 'var(--ui-surface-muted)', textAlign: 'left' }}>Составная интерактивная карточка</Pressable>
    <ChoiceCard selected icon={<Home />} title="Квартира" description="Отдельное жильё" />
    <InlineAlert title="Безопасная сделка">Не переводите деньги вне приложения до подтверждения брони.</InlineAlert>
    <Surface radius="lg" style={{ padding: 16, display: 'grid', gap: 10 }}><Skeleton width="46%" height={18} radius={8} /><Skeleton width="100%" height={92} radius={14} /><Skeleton width="76%" height={14} radius={7} /></Surface>
  </div>;
}
const meta = { title: 'UI Kit/Data display', component: DataDisplayGallery, tags: ['autodocs'] } satisfies Meta<typeof DataDisplayGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Gallery: Story = {};
