import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mail, Search } from 'lucide-react';
import { Checkbox, Counter, Field, HiddenFileInput, OneTimeCodeField, PhoneField, PickerButton, Select, Switch, TextArea, TextField } from '..';

function FormsGallery() {
  const [guests, setGuests] = useState(2);
  const [enabled, setEnabled] = useState(true);
  const [code, setCode] = useState('12');
  return <div style={{ width: 520, maxWidth: '100%', display: 'grid', gap: 18 }}>
    <Field label="Поиск" labelFor="story-search" messageId="story-search-help" description="Город, адрес или название"><TextField id="story-search" aria-describedby="story-search-help" before={<Search size={18} />} placeholder="Введите адрес" /></Field>
    <Field label="Электронная почта" labelFor="story-email" required><TextField id="story-email" before={<Mail size={18} />} type="email" defaultValue="demo@sutki.app" /></Field>
    <Field label="Телефон" labelFor="story-phone"><PhoneField id="story-phone" defaultValue="(999) 123-45-67" /></Field>
    <Field label="Дата"><PickerButton value="12 августа 2026" onClick={() => undefined} /></Field>
    <Field label="Код подтверждения"><OneTimeCodeField value={code} length={4} onValueChange={setCode} /></Field>
    <HiddenFileInput aria-label="Скрытый выбор файла" />
    <Field label="Город" labelFor="story-city"><Select id="story-city" defaultValue="kazan"><option value="kazan">Казань</option><option value="moscow">Москва</option><option value="spb">Санкт-Петербург</option></Select></Field>
    <Field label="Комментарий" labelFor="story-comment"><TextArea id="story-comment" showCount maxLength={300} defaultValue="Будем вдвоём, заселимся после 18:00." /></Field>
    <Checkbox label="Можно с питомцами" description="Гости увидят правило в объявлении" defaultChecked />
    <Switch label="Уведомления" description="Сообщать о новых заявках" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
    <Field label="Количество гостей"><Counter value={guests} min={1} max={8} onChange={setGuests} /></Field>
  </div>;
}
const meta = { title: 'UI Kit/Forms', component: FormsGallery, tags: ['autodocs'] } satisfies Meta<typeof FormsGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AllControls: Story = {};
