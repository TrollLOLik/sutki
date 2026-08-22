import { CalendarDays, Check, MapPin, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { demoSession, saveDemoProfileSetup, type AuthChannel } from '@features/auth';
import { BirthdayPickerSheet, formatBirthday, ProfileAvatarEditor } from '@features/profile';
import { CityPickerSheet } from '@features/search-filters';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { BadgeText, BodyText, Button, DescriptionText, Field, HeroTitle, PickerButton, TextField } from '@ui';
import { AuthStepScreen } from './AuthStepScreen';

interface ProfileSetupPageProps {
  identifier?: string;
  channel?: AuthChannel;
  onBack: () => void;
  onDone: () => void;
}

export function ProfileSetupPage({ identifier, channel, onBack, onDone }: ProfileSetupPageProps) {
  const desktopAutoFocus = useMediaQuery('(min-width: 900px)');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [city, setCity] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const canSubmit = name.trim().length >= 2 && city.trim().length >= 2;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return setError('Укажите имя и город');
    saveDemoProfileSetup({ name: name.trim(), surname: surname.trim(), city: city.trim(), birthday, avatar, phone: channel === 'phone' ? identifier ?? '' : '', email: channel === 'email' ? identifier ?? '' : '' });
    setComplete(true);
  };
  if (complete) return <main className="auth-success"><section><span><Check size={34} /></span><BadgeText as="p" color="secondary">Готово</BadgeText><HeroTitle>Профиль создан</HeroTitle><DescriptionText as="p">Добро пожаловать в «ВИГАЖ»</DescriptionText><Button size="lg" stretched onClick={() => { demoSession.completeOnboarding(); onDone(); }}>Начать</Button></section></main>;
  return <form id="auth-profile-setup-form" className="auth-profile-setup-page" onSubmit={submit}><AuthStepScreen contextClassName="auth-profile-setup-page" icon={<UserRound size={22} />} title="Создание профиля" description="Расскажите немного о себе. Эти данные можно изменить позже." onBack={onBack} footer={<Button type="submit" form="auth-profile-setup-form" size="md" stretched disabled={!canSubmit}>Продолжить</Button>}>
    <div className="auth-profile-avatar">
      <ProfileAvatarEditor value={avatar} onChange={setAvatar} onError={setAvatarError} />
      <BodyText as="p">Добавьте фото профиля</BodyText>
      {avatar ? <DescriptionText as="small">Фото будет видно другим пользователям. Не добавляйте документы и чувствительные персональные данные.</DescriptionText> : null}
      {avatarError ? <BadgeText as="small" className="is-error" color="danger" role="alert">{avatarError}</BadgeText> : null}
    </div>
    <Field label="Имя" required labelFor="setup-name" error={error && name.trim().length < 2 ? 'Введите имя — минимум 2 символа' : undefined}><TextField id="setup-name" autoFocus={desktopAutoFocus} value={name} before={<UserRound size={18} />} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Имя" /></Field>
    <Field label="Фамилия" labelFor="setup-surname"><TextField id="setup-surname" value={surname} before={<UserRound size={18} />} onChange={(event) => setSurname(event.target.value)} placeholder="Фамилия (необязательно)" /></Field>
    <Field label="Дата рождения"><PickerButton className="auth-picker-button" size="lg" value={formatBirthday(birthday) || 'Укажите дату рождения'} placeholder={!birthday} before={<CalendarDays size={18} />} after={null} onClick={() => setBirthdayOpen(true)} /></Field>
    <Field label="Город" required labelFor="setup-city" messageId="setup-city-error" error={error && city.trim().length < 2 ? 'Выберите город' : undefined}>
      <PickerButton
        id="setup-city"
        className="auth-picker-button"
        size="lg"
        value={city || 'Выберите город'}
        placeholder={!city}
        before={<MapPin size={18} />}
        after={null}
        aria-invalid={Boolean(error && city.trim().length < 2)}
        aria-describedby={error && city.trim().length < 2 ? 'setup-city-error' : undefined}
        onClick={() => setCityPickerOpen(true)}
      />
    </Field>
    <BirthdayPickerSheet open={birthdayOpen} value={birthday} onClose={() => setBirthdayOpen(false)} onApply={(value) => { setBirthday(value); setBirthdayOpen(false); }} />
    <CityPickerSheet
      open={cityPickerOpen}
      value={city || null}
      allowAny={false}
      autoFocus={false}
      onClose={() => setCityPickerOpen(false)}
      onSelect={(value) => {
        if (!value) return;
        setCity(value);
        setCityPickerOpen(false);
        setError('');
      }}
    />
  </AuthStepScreen></form>;
}
