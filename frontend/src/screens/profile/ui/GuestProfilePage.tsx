import {
  Building2,
  Heart,
  Home,
  KeyRound,
  LogIn,
  MessageCircle,
  MessageSquareText,
  Phone,
  Star,
} from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { DesktopTopbar } from '@widgets/app-navigation';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { applyThemePreference, setThemePreference } from '@shared/lib/theme';
import { BadgeText, BodyText, Button, HeroTitle, KeyValueRow, ListCell, SectionTitle } from '@ui';
import { loadProfile, type ProfileTheme } from '../model/profileStorage';
import { Metric, ThemeSelector } from './ProfileParts';
import { ProfileHeader } from './ProfileHeader';

export function GuestProfilePage({
  onHome,
  onCreate,
  onMap,
  onMessages,
  onFavorites,
  onAuth,
  onTabBarHiddenChange,
}: {
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onMessages: () => void;
  onFavorites: () => void;
  onAuth: (target?: 'profile' | 'my-listings' | 'my-reviews') => void;
  onTabBarHiddenChange: (hidden: boolean) => void;
}) {
  const [theme, setTheme] = useState<ProfileTheme>(() => loadProfile().theme);
  const desktop = useMediaQuery('(min-width: 900px)');

  useLayoutEffect(() => onTabBarHiddenChange(false), [onTabBarHiddenChange]);

  const changeTheme = (next: ProfileTheme, origin: { x: number; y: number }) => {
    if (next === theme) return;
    setTheme(next);
    setThemePreference(next, origin);
    applyThemePreference(next);
  };

  const hero = (
    <section className="profile-hero profile-card profile-guest-hero">
      <span className="profile-avatar-ring"><BodyText as="strong" weight={500}>Г</BodyText></span>
      <div className="profile-hero-copy">
        <BadgeText className="profile-brand-badge">Гостевой режим</BadgeText>
        <HeroTitle truncate>Вы не вошли</HeroTitle>
        <BodyText as="p" color="secondary">Избранное хранится на этом устройстве</BodyText>
      </div>
    </section>
  );
  const authCard = (
    <section className="profile-card profile-guest-auth-card">
      <div className="profile-guest-auth-copy">
        <span><KeyRound size={21} /></span>
        <div><SectionTitle as="strong">Войдите в аккаунт</SectionTitle><BodyText as="p" color="secondary">Бронируйте жильё, общайтесь с владельцами и управляйте своими объявлениями.</BodyText></div>
      </div>
      <Button className="profile-guest-auth-button" size="lg" mode="solid" tone="primary" stretched startIcon={<LogIn />} onClick={() => onAuth('profile')}>Войти или зарегистрироваться</Button>
    </section>
  );
  const metrics = (
    <section className="profile-metrics profile-card">
      <Metric standardTypography icon={Home} value="—" label="Объявления" neutral />
      <Metric standardTypography icon={Star} value="—" label="Рейтинг" neutral />
      <Metric standardTypography icon={Phone} value="Не указан" label="Номер телефона" neutral />
      <Metric standardTypography icon={MessageCircle} value="—" label="Сообщения" neutral />
    </section>
  );
  const localSection = (
    <section className="profile-section">
      <SectionTitle>На этом устройстве</SectionTitle>
      <div className="profile-action-group profile-card">
        <ListCell className="profile-action-row" beforeClassName="profile-action-icon" copyClassName="profile-action-copy" before={<Heart size={21} />} title="Избранное" subtitle="Жильё, сохранённое без аккаунта" onClick={onFavorites} />
      </div>
    </section>
  );
  const lockedSection = (
    <section className="profile-section">
      <SectionTitle>После входа</SectionTitle>
      <div className="profile-action-group profile-card">
        <ListCell className="profile-action-row profile-action-row--locked" beforeClassName="profile-action-icon" copyClassName="profile-action-copy" before={<Building2 size={21} />} title="Мои объявления" subtitle="Объекты, цены и календарь доступности" onClick={() => onAuth('my-listings')} />
        <ListCell className="profile-action-row profile-action-row--locked" beforeClassName="profile-action-icon" copyClassName="profile-action-copy" before={<MessageSquareText size={21} />} title="Мои отзывы" subtitle="Оставленные и полученные отзывы" onClick={() => onAuth('my-reviews')} />
      </div>
    </section>
  );
  const themeCard = <ThemeSelector standardTypography value={theme} onChange={changeTheme} />;
  const aboutCard = (
    <section className="profile-section profile-info-section">
      <SectionTitle>О приложении</SectionTitle>
      <div className="profile-card profile-about-card">
        <KeyValueRow label="Версия" value="1.0.0" />
        <KeyValueRow label="Поддержка" value="support@domryadom.ru" valueColor="accent" />
        <KeyValueRow label="Язык" value="Русский" />
      </div>
    </section>
  );

  return (
    <div className="profile-screen profile-guest-screen">
      <DesktopTopbar active="profile" onSearch={onHome} onMap={onMap} onMessages={onMessages} onProfile={() => undefined} onCreate={onCreate} />

      <ProfileHeader presentation="mobile" onBack={onHome} />

      <main className="profile-content">
        <ProfileHeader presentation="desktop" onBack={onHome} />
        {desktop ? (
          <div className="profile-detail-layout profile-detail-layout--guest">
            <div className="profile-detail-primary">{hero}{authCard}{metrics}</div>
            <aside className="profile-detail-summary">{localSection}{lockedSection}{themeCard}{aboutCard}</aside>
          </div>
        ) : <>{hero}{authCard}{metrics}{localSection}{lockedSection}{themeCard}{aboutCard}</>}
      </main>

    </div>
  );
}
