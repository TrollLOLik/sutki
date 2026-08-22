import {
  CheckCircle2,
  Home,
  LogOut,
  MapPin,
  MessageCircle,
  PlusCircle,
  Star,
} from 'lucide-react';
import { ProfileAvatarEditor } from '@features/profile';
import { useMediaQuery } from '@shared/lib/adaptivity';
import {
  BadgeText,
  BodyText,
  Button,
  DescriptionText,
  HeroTitle,
  KeyValueRow,
  ListCell,
  SectionTitle,
} from '@ui';
import {
  profileDisplayName,
  profileInitials,
  type ProfileData,
  type ProfileTheme,
} from '../model/profileStorage';
import type { ProfileActionGroup, ProfileSettingsTab } from '../model/profileViewTypes';
import { Metric, ThemeSelector } from './ProfileParts';

export type { ProfileActionGroup, ProfileSettingsTab } from '../model/profileViewTypes';

interface ProfileOverviewProps {
  profile: ProfileData;
  listingsCount: number;
  completion: number;
  avatarError: string;
  actionGroups: ProfileActionGroup[];
  onAvatarChange: (avatar: string) => void;
  onAvatarError: (message: string) => void;
  onOpenSettings: (tab: ProfileSettingsTab) => void;
  onThemeChange: (theme: ProfileTheme, origin: { x: number; y: number }) => void;
  onCopySupport: () => void;
  onRequestSignOut: () => void;
}

export function ProfileOverview({
  profile,
  listingsCount,
  completion,
  avatarError,
  actionGroups,
  onAvatarChange,
  onAvatarError,
  onOpenSettings,
  onThemeChange,
  onCopySupport,
  onRequestSignOut,
}: ProfileOverviewProps) {
  const desktop = useMediaQuery('(min-width: 900px)');
  const hero = (
      <section className="profile-hero profile-card">
        <div className="profile-hero-avatar-field">
          <ProfileAvatarEditor
            variant="profile"
            value={profile.avatar}
            emptyContent={profileInitials(profile)}
            onChange={onAvatarChange}
            onError={onAvatarError}
          />
        </div>
        <div className="profile-hero-copy">
          <BadgeText className="profile-brand-badge">ВИГАЖ</BadgeText>
          <HeroTitle truncate>{profileDisplayName(profile)}</HeroTitle>
          <BodyText as="p" color="secondary"><MapPin size={15} /><BodyText color="inherit" truncate>{profile.city || 'Город не указан'}</BodyText></BodyText>
          <DescriptionText as="small" truncate>В ВИГАЖ с августа 2026 года</DescriptionText>
        </div>
        {avatarError ? <DescriptionText as="p" color="danger" className="profile-avatar-editor-error profile-hero-avatar-error" role="alert">{avatarError}</DescriptionText> : null}
      </section>
  );
  const metrics = (
      <section className="profile-metrics profile-card">
        <Metric standardTypography icon={Home} value={String(listingsCount)} label="Объявления" />
        <Metric standardTypography icon={Star} value="—" label="Рейтинг" neutral />
        <Metric standardTypography icon={CheckCircle2} value={profile.phone ? 'Подтверждён' : 'Не указан'} label="Номер телефона" success={Boolean(profile.phone)} neutral={!profile.phone} />
        <Metric standardTypography icon={MessageCircle} value="—" label="Среднее время ответа" />
      </section>
  );
  const actions = actionGroups.map((group) => (
        <section className="profile-section" key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <div className="profile-action-group profile-card">
            {group.items.map((item) => (
              <ListCell
                className="profile-action-row"
                key={item.title}
                beforeClassName="profile-action-icon"
                copyClassName="profile-action-copy"
                before={<item.icon size={21} />}
                title={item.title}
                subtitle={item.subtitle}
                after={item.count ? <BadgeText as="em" className="profile-action-count" color="inverse">{item.count}</BadgeText> : undefined}
                onClick={item.onClick}
              />
            ))}
          </div>
        </section>
  ));
  const completionCard = (
      <section className="profile-section profile-info-section">
        <SectionTitle>Заполнение профиля</SectionTitle>
        <div className="profile-card profile-completion-card">
          <div className="profile-completion-head"><DescriptionText>{completion === 100 ? 'Всё готово' : 'Осталось немного'}</DescriptionText><DescriptionText as="strong" weight={500} color="accent">{completion}%</DescriptionText></div>
          <div className="profile-progress"><i style={{ width: `${completion}%` }} /></div>
          {completion === 100 ? (
            <div className="profile-complete-message"><CheckCircle2 size={21} /> <DescriptionText weight={500} color="inherit">Основные данные заполнены</DescriptionText></div>
          ) : (
            <div className="profile-completion-list">
              {!profile.avatar ? <ListCell before={<PlusCircle size={19} />} title="Добавить аватарку" onClick={() => onOpenSettings('basic')} /> : null}
              {!profile.phone ? <ListCell before={<PlusCircle size={19} />} title="Добавить телефон" onClick={() => onOpenSettings('basic')} /> : null}
              {!profile.email ? <ListCell before={<PlusCircle size={19} />} title="Добавить почту" onClick={() => onOpenSettings('security')} /> : null}
            </div>
          )}
        </div>
      </section>
  );
  const themeCard = <ThemeSelector standardTypography value={profile.theme} onChange={onThemeChange} />;
  const aboutCard = (
      <section className="profile-section profile-info-section">
        <SectionTitle>О приложении</SectionTitle>
        <div className="profile-card profile-about-card">
          <KeyValueRow label="Версия" value="1.0.0" />
          <KeyValueRow label="Поддержка" value="support@domryadom.ru" valueColor="accent" onClick={onCopySupport} />
          <KeyValueRow label="Язык" value="Русский" />
        </div>
      </section>
  );
  const signOutButton = <Button className="profile-signout-button" size="lg" mode="outline" tone="neutral" stretched startIcon={<LogOut />} onClick={onRequestSignOut}>Выйти</Button>;

  if (desktop) {
    return (
      <div className="profile-detail-layout">
        <div className="profile-detail-primary">{hero}{metrics}{completionCard}</div>
        <aside className="profile-detail-summary">{actions}{themeCard}{aboutCard}{signOutButton}</aside>
      </div>
    );
  }

  return (
    <>
      {hero}
      {metrics}
      {actions}
      {completionCard}
      {themeCard}
      {aboutCard}
      {signOutButton}
    </>
  );
}
