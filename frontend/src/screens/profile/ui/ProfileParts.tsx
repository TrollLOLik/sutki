import {
  BadgeCheck,
  MonitorSmartphone,
  Gauge,
  Moon,
  Palette,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { readComponentMarkers, readMotionPreference, setComponentMarkers, setMotionPreference, subscribeComponentMarkers, subscribeMotionPreference } from '@shared/lib/theme';
import { BadgeText, BodyText, Button, DescriptionText, Field, ListCell, Stat, Switch, TextField, type TextFieldProps } from '@ui';
import type { ProfileTheme } from '../model/profileStorage';

export function Metric({ icon: Icon, value, label, success, neutral }: { icon: LucideIcon; value: string; label: string; success?: boolean; neutral?: boolean; standardTypography?: boolean }) {
  return <Stat className={`profile-metric ${success ? 'success' : neutral ? 'neutral' : ''}`} wrapIcon icon={<Icon size={18} />} value={value} label={label} />;
}

type ThemeOrigin = { x: number; y: number };

export function ThemeSelector({ value, onChange }: { value: ProfileTheme; onChange: (theme: ProfileTheme, origin: ThemeOrigin) => void; standardTypography?: boolean }) {
  const motion = useSyncExternalStore(subscribeMotionPreference, readMotionPreference, () => 'full');
  const componentMarkers = useSyncExternalStore(subscribeComponentMarkers, readComponentMarkers, () => true);
  const options = [
    { value: 'light' as const, label: 'Светлая', icon: Sun },
    { value: 'dark' as const, label: 'Тёмная', icon: Moon },
    { value: 'system' as const, label: 'Системная', icon: MonitorSmartphone },
  ];
  return (
    <section className="profile-card profile-theme-card">
      <header><span><Palette size={20} /></span><div><BodyText as="strong" weight={500}>Оформление</BodyText><DescriptionText as="small">Выберите тему приложения</DescriptionText></div></header>
      <div className="profile-theme-options" role="radiogroup" aria-label="Тема приложения">
        {options.map((option) => <Button key={option.value} size="sm" mode="ghost" tone="neutral" role="radio" aria-checked={value === option.value} className={value === option.value ? 'active' : ''} startIcon={<option.icon size={15} />} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); onChange(option.value, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }); }}>{option.label}</Button>)}
      </div>
      <Switch className="profile-motion-setting" before={<Gauge size={17} />} checked={motion === 'full'} label="Анимации интерфейса" description={motion === 'full' ? 'Плавные переходы включены' : 'Переходы и эффекты выключены'} onChange={() => setMotionPreference(motion === 'full' ? 'reduced' : 'full')} />
      <Switch className="profile-motion-setting profile-marker-setting" before={<BadgeCheck size={17} />} checked={componentMarkers} label="Метки компонентов" description={componentMarkers ? 'Служебные значки показаны' : 'Служебные значки скрыты'} onChange={() => setComponentMarkers(!componentMarkers)} />
    </section>
  );
}

export function ProfileField({ label, icon: Icon, id, invalid, error, messageId, 'aria-describedby': ariaDescribedBy, ...props }: { label: string; icon: LucideIcon; error?: string; messageId?: string } & Omit<TextFieldProps, 'before' | 'size'>) {
  const resolvedMessageId = messageId ?? (id ? `${id}-error` : undefined);
  return <Field label={label} labelFor={id} error={error} messageId={resolvedMessageId} className="profile-input-field"><TextField {...props} id={id} invalid={invalid || Boolean(error)} aria-describedby={error ? resolvedMessageId : ariaDescribedBy} size="md" before={<Icon size={20} />} /></Field>;
}

export function SecurityMethod({ icon: Icon, title, value, status, action = false, onClick }: { icon: LucideIcon; title: string; value: string; status: string; action?: boolean; onClick: () => void }) {
  return <ListCell className="profile-security-method" before={<Icon size={17} />} title={title} subtitle={value} after={<BadgeText as="em" color={action ? 'secondary' : 'success'} className={action ? 'is-action' : 'is-success'}>{status}</BadgeText>} onClick={onClick} />;
}
