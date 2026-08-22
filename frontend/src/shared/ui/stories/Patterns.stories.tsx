import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarDays, SlidersHorizontal, Sparkles } from 'lucide-react';
import { BottomSheet, Button, DialogActions, DualRange, Field, FormSection, FullPageModal, ListPageHeader, Modal, PersonalListToolbar, PickerField, Radio, RouteActionBarPortal, SearchField, SortSurface, Stack, StickyActionBar, ToggleCard } from '..';

function PatternsGallery() {
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState('Казань');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [fullPage, setFullPage] = useState(false);
  const [instant, setInstant] = useState(true);
  const [range, setRange] = useState<[number, number]>([2000, 8000]);
  return (
    <RouteActionBarPortal>
    <Stack gap={20} style={{ width: 660, maxWidth: '100%' }}>
      <ListPageHeader presentation="mobile" title="Уведомления" onBack={() => undefined} />
      <PickerField label="Город" value={query} onClick={() => undefined} />
      <FormSection title="Поиск жилья" description="Паттерн секции формы" action={<Button size="sm" variant="tertiary">Сбросить</Button>}>
        <Field label="Город"><SearchField value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} /></Field>
        <ToggleCard checked={instant} icon={<Sparkles size={18} />} title="Мгновенное бронирование" description="Без ожидания подтверждения" onChange={() => setInstant((value) => !value)} />
        <DualRange min={0} max={12000} step={500} valueMin={range[0]} valueMax={range[1]} onChange={(min, max) => setRange([min, max])} />
        <Radio name="sort" label="По популярности" defaultChecked />
        <Radio name="sort" label="Сначала дешевле" />
      </FormSection>
      <PersonalListToolbar query={query} onQueryChange={setQuery} placeholder="Поиск" sort={sort} sortOpen={sortOpen} onSortOpenChange={setSortOpen} onSortChange={setSort} sortOptions={[{ value: 'newest', label: 'Сначала новые' }, { value: 'oldest', label: 'Сначала старые' }]} />
      <SortSurface open={false} value={sort} onOpenChange={() => undefined} onChange={setSort} options={[{ value: 'newest', label: 'Сначала новые' }, { value: 'oldest', label: 'Сначала старые' }]} />
      <Stack direction="row" wrap gap={10}>
        <Button before={<SlidersHorizontal size={18} />} onClick={() => setModal(true)}>Открыть фильтры</Button>
        <Button variant="secondary" before={<CalendarDays size={18} />} onClick={() => setSheet(true)}>Выбрать даты</Button>
        <Button variant="secondary" onClick={() => setFullPage(true)}>Полноэкранное окно</Button>
      </Stack>
      <Modal open={modal} title="Фильтры" description="Единая нижняя панель действий" onClose={() => setModal(false)} footer={<DialogActions reset={<Button variant="tertiary">Сбросить</Button>} primary={<Button onClick={() => setModal(false)}>Показать 24 варианта</Button>} />}>
        <p style={{ margin: 0, color: 'var(--ink-secondary)' }}>Контент фильтров размещается в прокручиваемой области модального окна.</p>
      </Modal>
      <BottomSheet open={sheet} title="Даты поездки" subtitle="Выберите заезд и выезд" onClose={() => setSheet(false)} footer={<DialogActions reset={<Button variant="tertiary">Сбросить</Button>} primary={<Button onClick={() => setSheet(false)}>Готово</Button>} />}>
        <p style={{ margin: 0, color: 'var(--ink-secondary)' }}>Здесь подключается общий календарь диапазона.</p>
      </BottomSheet>
      <FullPageModal open={fullPage} title="Каталог" onClose={() => setFullPage(false)}><div style={{ padding: 20 }}>Общий каркас полноэкранного окна.</div></FullPageModal>
      <div style={{ position: 'relative', minHeight: 90 }}><StickyActionBar style={{ position: 'absolute' }}><Button stretched>Продолжить</Button></StickyActionBar></div>
    </Stack>
    </RouteActionBarPortal>
  );
}

const meta = { title: 'UI Kit/Product patterns', component: PatternsGallery, tags: ['autodocs'] } satisfies Meta<typeof PatternsGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DialogsAndForms: Story = {};
