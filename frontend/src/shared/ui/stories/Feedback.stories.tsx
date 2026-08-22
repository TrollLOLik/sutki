import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, CompactAlert, EmptyState, InlineAlert, Placeholder, Progress, PullToRefreshIndicator, Skeleton, Snackbar, Spinner, Stack } from '..';

function FeedbackGallery() {
  const [snackbar, setSnackbar] = useState(true);
  return (
    <Stack gap={20} style={{ width: 620, maxWidth: '100%' }}>
      <Stack direction="row" gap={16} align="center"><Spinner size="sm" /><Spinner /><Spinner size="lg" /></Stack>
      <Progress value={68} label="Заполнение объявления" />
      <PullToRefreshIndicator pullDistance={72} refreshing={false} />
      <InlineAlert tone="info" title="Информация">Заявка хранится только в текущей сессии.</InlineAlert>
      <InlineAlert tone="success" title="Готово">Бронирование подтверждено.</InlineAlert>
      <InlineAlert tone="warning" title="Проверьте даты">Часть выбранного диапазона уже занята.</InlineAlert>
      <InlineAlert tone="danger" title="Ошибка">Не удалось отправить сообщение.</InlineAlert>
      <CompactAlert tone="warning" title="Проверьте данные" meta="Дополнительная информация">Компактное предупреждение для форм и карточек.</CompactAlert>
      <Stack gap={8}><Skeleton width="45%" height={18} /><Skeleton width="100%" height={88} radius={16} /></Stack>
      <EmptyState title="Заявок пока нет" description="Когда гости отправят запрос, он появится здесь." />
      <Placeholder title="Раздел в разработке" description="Универсальная заглушка для route-level экранов." actionLabel="Вернуться" onAction={() => undefined} />
      <Button variant="secondary" onClick={() => setSnackbar(true)}>Показать snackbar</Button>
      <Snackbar open={snackbar} tone="success" onClose={() => setSnackbar(false)}>Изменения сохранены</Snackbar>
    </Stack>
  );
}

const meta = { title: 'UI Kit/Feedback', component: FeedbackGallery, tags: ['autodocs'] } satisfies Meta<typeof FeedbackGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AllStates: Story = {};
