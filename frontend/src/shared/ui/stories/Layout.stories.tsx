import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, Container, Grid, ScrollArea, Stack, Surface, Typography } from '..';

function LayoutGallery() {
  return (
    <Container size="lg" gutters="none">
      <Stack gap={24}>
        <Stack gap={8}>
          <Typography as="h1" variant="title1">Layout primitives</Typography>
          <Typography tone="secondary">Контейнеры, сетки и поверхности без page-specific CSS.</Typography>
        </Stack>
        <Grid minColumnWidth={210} gap={14}>
          {['Поиск', 'Сообщения', 'Заявки', 'Профиль'].map((title, index) => (
            <Card key={title} interactive level="raised" radius="xl" footer={<Typography variant="caption" tone="secondary">Секция {index + 1}</Typography>}>
              <Stack gap={8}>
                <Typography variant="title3">{title}</Typography>
                <Typography variant="subhead" tone="secondary">Карточка собирается из токенов и адаптируется к теме.</Typography>
              </Stack>
            </Card>
          ))}
        </Grid>
        <Surface level="muted" radius="lg" style={{ padding: 16 }}>
          <Stack direction="row" wrap align="center" justify="space-between" gap={12}>
            <Typography weight="bold">Горизонтальный Stack</Typography>
            <Typography variant="caption" tone="secondary">wrap + space-between</Typography>
          </Stack>
        </Surface>
        <ScrollArea axis="horizontal" ariaLabel="Горизонтальный пример прокрутки" className="ui-story-scroll-area">
          <Stack direction="row" gap={12} style={{ width: 'max-content', padding: 4 }}>
            {Array.from({ length: 8 }, (_, index) => (
              <Surface key={index} level="raised" radius="lg" style={{ minWidth: 160, padding: 16 }}>
                <Typography weight="semibold">Карточка {index + 1}</Typography>
              </Surface>
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Container>
  );
}

const meta = { title: 'UI Kit/Layout', component: LayoutGallery, tags: ['autodocs'], parameters: { layout: 'padded' } } satisfies Meta<typeof LayoutGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Gallery: Story = {};
