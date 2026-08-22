import type { Meta, StoryObj } from '@storybook/react-vite';

function Foundations() {
  const colors = [
    ['Primary', '--primary'], ['Surface', '--surface'], ['Raised', '--surface-raised'], ['Muted', '--surface-muted'],
    ['Ink', '--ink'], ['Secondary', '--ink-secondary'], ['Line', '--line'], ['Success', '--success'], ['Danger', '--danger'],
  ];
  const spacing = [4, 8, 12, 16, 20, 24, 32, 40];
  return (
    <div style={{ width: 'min(100%, 920px)', display: 'grid', gap: 32 }}>
      <section><h1 style={{ margin: 0 }}>Sutki UI Kit</h1><p style={{ color: 'var(--ink-secondary)' }}>Семантические токены, адаптивные компоненты и состояния для светлой и тёмной тем.</p></section>
      <section><h2>Цвета</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>{colors.map(([name, token]) => <article key={token} style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)' }}><div style={{ height: 76, background: `var(${token})` }} /><div style={{ padding: 12 }}><strong>{name}</strong><small style={{ display: 'block', color: 'var(--ink-muted)' }}>{token}</small></div></article>)}</div></section>
      <section><h2>Типографика</h2><div style={{ display: 'grid', gap: 12, padding: 20, border: '1px solid var(--line)', borderRadius: 20, background: 'var(--surface)' }}><span style={{ fontSize: 32, fontWeight: 500 }}>Заголовок страницы</span><span style={{ fontSize: 24, fontWeight: 500 }}>Заголовок секции</span><span style={{ fontSize: 18, fontWeight: 500 }}>Заголовок карточки</span><span style={{ fontSize: 14 }}>Основной текст интерфейса</span><small style={{ color: 'var(--ink-secondary)' }}>Вторичный текст и подписи</small></div></section>
      <section><h2>Движение</h2><div className="motion-token-grid"><button type="button" className="primary-button">Быстрое нажатие · 140 мс</button><article className="similar-listings-notice"><span>250</span><div><strong>Базовый переход</strong><p>Сворачивание шапки, оверлеи и смена состояний.</p></div></article></div></section>
      <section><h2>Шкала отступов</h2><div style={{ display: 'grid', gap: 10 }}>{spacing.map((value) => <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 12 }}><code style={{ width: 42 }}>{value}px</code><span style={{ display: 'block', height: 16, width: value * 4, maxWidth: '80%', borderRadius: 4, background: 'var(--primary)' }} /></div>)}</div></section>
    </div>
  );
}

const meta = { title: 'Foundations/Design tokens', component: Foundations, tags: ['autodocs'], parameters: { layout: 'padded' } } satisfies Meta<typeof Foundations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
