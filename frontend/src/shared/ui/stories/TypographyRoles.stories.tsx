import type { Meta, StoryObj } from '@storybook/react-vite';
import { BadgeText, BodyText, DescriptionText, HeroTitle, PageTitle, SectionTitle } from '../Typography';

function TypographyRolesPreview() {
  return (
    <div style={{ width: 'min(100%, 680px)', display: 'grid', gap: 24 }}>
      <section style={{ display: 'grid', gap: 12 }}>
        <HeroTitle>ФИО пользователя · 22 px</HeroTitle>
        <PageTitle>Заголовок страницы · 18 px</PageTitle>
        <SectionTitle>Заголовок секции · 16 px</SectionTitle>
        <BodyText>Основной текст · 14 px</BodyText>
        <DescriptionText>Дополнительное описание · 12 px</DescriptionText>
        <BadgeText>БЕЙДЖ · 9 px</BadgeText>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <BodyText weight={400}>Обычный вес · 400</BodyText>
        <BodyText weight={500}>Акцентный вес · 500</BodyText>
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <DescriptionText color="default">default</DescriptionText>
        <DescriptionText color="secondary">secondary</DescriptionText>
        <DescriptionText color="muted">muted</DescriptionText>
        <DescriptionText color="accent">accent</DescriptionText>
        <DescriptionText color="success">success</DescriptionText>
        <DescriptionText color="danger">danger</DescriptionText>
        <DescriptionText color="warning">warning</DescriptionText>
      </section>

      <section style={{ width: 230, minWidth: 0 }}>
        <BodyText truncate title="Длинный текст обрезается только когда truncate включён извне">
          Длинный текст обрезается только когда truncate включён извне
        </BodyText>
      </section>
    </div>
  );
}

const meta = {
  title: 'Foundations/Typography roles',
  component: TypographyRolesPreview,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TypographyRolesPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
