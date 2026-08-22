import { useState, type ReactNode } from 'react';
import { ArrowLeft, Bell, CalendarDays, Heart, Home, Mail, MapPin, Search, ShieldCheck, Star } from 'lucide-react';
import {
  AppHeader,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Chip,
  Counter,
  Field,
  IconButton,
  InlineAlert,
  ListCell,
  SegmentedControl,
  Select,
  Surface,
  Switch,
  Tabs,
  TextArea,
  TextField,
  BodyText,
  DescriptionText,
  PageTitle,
  SectionTitle,
} from '@ui';
import '../ui-kit-page.css';

export function UiKitPage({ onBack }: { onBack: () => void }) {
  const [segment, setSegment] = useState<'current' | 'history'>('current');
  const [tab, setTab] = useState<'all' | 'unread' | 'archive'>('all');
  const [guests, setGuests] = useState(2);
  const [notifications, setNotifications] = useState(true);
  return (
    <main className="ui-kit-page">
      <AppHeader title="Sutki UI Kit" subtitle="Компоненты и паттерны" onBack={onBack} sticky />
      <div className="ui-kit-page__content">
        <section className="ui-kit-hero"><div><Badge tone="primary">v1.0</Badge><PageTitle className="ui-text--inherit-metrics" color="inherit">Один набор компонентов для всего проекта</PageTitle><DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">Семантические токены, светлая и тёмная темы, mobile-first и доступные интерактивные состояния.</DescriptionText></div><ShieldCheck size={64} /></section>

        <KitSection title="Actions">
          <div className="ui-kit-row"><Button>Основная</Button><Button variant="secondary">Вторичная</Button><Button variant="tertiary">Текстовая</Button><Button variant="success">Принять</Button><Button variant="danger">Отклонить</Button></div>
          <div className="ui-kit-row"><IconButton label="Избранное" icon={<Heart size={20} />} /><IconButton label="Уведомления" variant="primary" icon={<Bell size={20} />} /><Chip>Студия</Chip><Chip selected>1 комната</Chip><Chip removable>Wi‑Fi</Chip></div>
        </KitSection>

        <KitSection title="Forms">
          <div className="ui-kit-grid">
            <Field label="Поиск" labelFor="kit-search"><TextField id="kit-search" before={<Search size={18} />} placeholder="Город или адрес" /></Field>
            <Field label="Почта" labelFor="kit-email"><TextField id="kit-email" before={<Mail size={18} />} defaultValue="demo@sutki.app" /></Field>
            <Field label="Город" labelFor="kit-city"><Select id="kit-city" defaultValue="kazan"><option value="kazan">Казань</option><option value="moscow">Москва</option></Select></Field>
            <Field label="Гости"><Counter value={guests} min={1} max={8} onChange={setGuests} /></Field>
          </div>
          <Field label="Комментарий" labelFor="kit-comment"><TextArea id="kit-comment" showCount maxLength={300} placeholder="Расскажите владельцу о поездке" /></Field>
          <Checkbox label="Можно с питомцами" description="Правило будет видно гостям" defaultChecked />
          <Switch label="Уведомления" description="Сообщать о заявках и сообщениях" checked={notifications} onChange={(event) => setNotifications(event.target.checked)} />
        </KitSection>

        <KitSection title="Navigation and lists">
          <SegmentedControl value={segment} onChange={setSegment} options={[{ value: 'current', label: 'Текущие' }, { value: 'history', label: 'История' }]} />
          <Tabs value={tab} onChange={setTab} options={[{ value: 'all', label: 'Все' }, { value: 'unread', label: 'Непрочитанные', badge: 3 }, { value: 'archive', label: 'Архив' }]} />
          <Surface radius="xl"><ListCell before={<Home size={19} />} title="Мои объявления" subtitle="3 активных" /><ListCell before={<CalendarDays size={19} />} title="Входящие заявки" after={<Badge tone="danger">4</Badge>} /><ListCell before={<MapPin size={19} />} title="Карта" subtitle="Показать жильё рядом" /></Surface>
        </KitSection>

        <KitSection title="Data display">
          <div className="ui-kit-row"><Avatar name="Анна Смирнова" size="lg" online verified /><Avatar name="Иван Петров" size="lg" /><Badge tone="success">Подтверждена</Badge><Badge tone="warning">Ожидает</Badge><Badge tone="danger">Отклонена</Badge></div>
          <InlineAlert title="Безопасная сделка">Не переводите деньги вне приложения до подтверждения заявки.</InlineAlert>
          <Surface radius="xl" className="ui-kit-demo-card"><BodyText className="ui-text--inherit-metrics" color="inherit"><Star size={17} fill="currentColor" /> 4.9</BodyText><SectionTitle as="h3" className="ui-text--inherit-metrics" color="inherit">Уютная квартира в центре</SectionTitle><DescriptionText as="p" className="ui-text--inherit-metrics" color="inherit">Казань, ул. Баумана, 12</DescriptionText><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit" weight={500}>4 500 ₽ / ночь</BodyText></Surface>
        </KitSection>
      </div>
    </main>
  );
}

function KitSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ui-kit-section"><header><SectionTitle className="ui-text--inherit-metrics" color="inherit">{title}</SectionTitle><ArrowLeft size={18} /></header><div>{children}</div></section>;
}
