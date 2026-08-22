import {
  CalendarDays,
  Laptop,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { TouchEventHandler, UIEvent } from 'react';
import { formatBirthday, ProfileAvatarEditor } from '@features/profile';
import {
  BadgeText,
  BodyText,
  Button,
  CompactAlert,
  DescriptionText,
  IconButton,
  PhonePickerField,
  PickerField,
  SectionTitle,
} from '@ui';
import type { ProfileData, SessionItem } from '../model/profileStorage';
import { ProfileField, SecurityMethod } from './ProfileParts';
import type { ProfileSettingsTab } from './ProfileOverview';

interface ProfileSettingsPanelsProps {
  activeTab: ProfileSettingsTab;
  swipeDragging: boolean;
  swipeOffset: number;
  draft: ProfileData;
  sessions: SessionItem[];
  avatarError: string;
  nameError?: string;
  onTouchStart: TouchEventHandler<HTMLDivElement>;
  onTouchMove: TouchEventHandler<HTMLDivElement>;
  onTouchEnd: TouchEventHandler<HTMLDivElement>;
  onTouchCancel: () => void;
  onPanelNode: (tab: ProfileSettingsTab, node: HTMLDivElement | null) => void;
  onPanelScroll: (tab: ProfileSettingsTab, event: UIEvent<HTMLDivElement>) => void;
  onDraftPatch: (patch: Partial<ProfileData>) => void;
  onAvatarError: (message: string) => void;
  onClearNameError: () => void;
  onOpenContact: (target: 'email' | 'phone') => void;
  onOpenCity: () => void;
  onOpenBirthday: () => void;
  onRequestRevokeSession: (session: SessionItem) => void;
  onRequestRevokeOtherSessions: () => void;
  onOpenDelete: () => void;
}

export function ProfileSettingsPanels({
  activeTab,
  swipeDragging,
  swipeOffset,
  draft,
  sessions,
  avatarError,
  nameError,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onPanelNode,
  onPanelScroll,
  onDraftPatch,
  onAvatarError,
  onClearNameError,
  onOpenContact,
  onOpenCity,
  onOpenBirthday,
  onRequestRevokeSession,
  onRequestRevokeOtherSessions,
  onOpenDelete,
}: ProfileSettingsPanelsProps) {
  const setPanelNode = (tab: ProfileSettingsTab, node: HTMLDivElement | null) => {
    if (node) node.inert = activeTab !== tab;
    onPanelNode(tab, node);
  };

  return (
    <div className="profile-settings-scroll" data-lenis-prevent="" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}>
      <div className={`profile-settings-track ${swipeDragging ? 'is-dragging' : ''}`} style={{ transform: `translate3d(calc(${activeTab === 'security' ? '-50%' : '0%'} + ${swipeOffset}px), 0, 0)` }}>
        <div ref={(node) => setPanelNode('basic', node)} onScroll={(event) => onPanelScroll('basic', event)} id="profile-settings-basic-panel" role="tabpanel" aria-hidden={activeTab !== 'basic'} className="profile-settings-tab-panel">
          <div className="profile-settings-panel">
            <section id="profile-avatar-editor" className="profile-avatar-editor profile-card">
              <ProfileAvatarEditor
                variant="settings"
                value={draft.avatar}
                onChange={(avatar) => onDraftPatch({ avatar })}
                onError={onAvatarError}
              />
              {avatarError ? <DescriptionText as="p" color="danger" className="profile-avatar-editor-error" role="alert">{avatarError}</DescriptionText> : null}
            </section>

            <SectionTitle as="h3">Личные данные</SectionTitle>
            <ProfileField label="Фамилия" icon={UserRound} value={draft.surname} onChange={(event) => onDraftPatch({ surname: event.target.value })} placeholder="Ваша фамилия (необязательно)" />
            <ProfileField label="Имя" icon={UserRound} id="profile-name-field" error={nameError} value={draft.name} onChange={(event) => { onDraftPatch({ name: event.target.value }); onClearNameError(); }} placeholder="Ваше имя" />
            <ProfileField label="Отчество" icon={UserRound} value={draft.patronymic} onChange={(event) => onDraftPatch({ patronymic: event.target.value })} placeholder="Ваше отчество (необязательно)" />

            <SectionTitle as="h3">Контакты и город</SectionTitle>
            <PhonePickerField label="Телефон" value={draft.phone.replace(/^\+7\s?/, '')} onClick={() => onOpenContact('phone')} size="md" />
            <PickerField label="Город" before={<MapPin size={20} />} value={draft.city || 'Выберите город'} placeholder={!draft.city} onClick={onOpenCity} accent size="md" />
            <PickerField label="Дата рождения" before={<CalendarDays size={20} />} value={formatBirthday(draft.birthday) || 'Укажите дату рождения'} onClick={onOpenBirthday} accent placeholder={!draft.birthday} size="md" />
          </div>
        </div>

        <div ref={(node) => setPanelNode('security', node)} onScroll={(event) => onPanelScroll('security', event)} id="profile-settings-security-panel" role="tabpanel" aria-hidden={activeTab !== 'security'} className="profile-settings-tab-panel">
          <div className="profile-settings-panel profile-security-panel">
            <SectionTitle as="h3">Способы входа</SectionTitle>
            <section className="profile-card profile-login-methods">
              <SecurityMethod icon={Mail} title="Электронная почта" value={draft.email || 'Не заполнено'} status={draft.email ? 'Подтверждена' : 'Добавить'} action={!draft.email.trim()} onClick={() => onOpenContact('email')} />
              {!draft.email.trim() ? <CompactAlert className="profile-login-email-note" tone="warning" icon={<LockKeyhole size={19} />} title="Добавьте резервную почту" descriptionColor="secondary">Без неё при потере доступа к номеру восстановить аккаунт может быть невозможно.</CompactAlert> : null}
              <SecurityMethod icon={Phone} title="Номер телефона" value={draft.phone || 'Не заполнено'} status={draft.phone ? 'Подтверждён' : 'Добавить'} action={!draft.phone.trim()} onClick={() => onOpenContact('phone')} />
            </section>

            <SectionTitle as="h3">Устройства входа</SectionTitle>
            <div className="profile-session-list">
              {sessions.map((session) => (
                <section className="profile-card profile-session" key={session.id}>
                  <span className="profile-session-icon">{session.os.toLowerCase().includes('ios') ? <Smartphone size={21} /> : <Laptop size={21} />}</span>
                  <div><BodyText as="strong" weight={500} truncate>{session.device}</BodyText>{session.current ? <BadgeText as="em" color="success">Сейчас</BadgeText> : null}<DescriptionText as="p">{session.location} · {session.ip}</DescriptionText><BadgeText as="small" weight={400} color="muted">ВИГАЖ v1.0.0 · {session.os} · {session.lastActive}</BadgeText></div>
                  {!session.current ? <IconButton label={`Завершить сеанс ${session.device}`} size="sm" mode="soft" tone="danger" icon={<Trash2 />} onClick={() => onRequestRevokeSession(session)} /> : null}
                </section>
              ))}
            </div>
            {sessions.some((session) => !session.current) ? <Button size="lg" mode="outline" tone="danger" stretched onClick={onRequestRevokeOtherSessions}>Завершить все другие сеансы</Button> : null}

            <SectionTitle as="h3" color="danger" className="profile-danger-title">Опасная зона</SectionTitle>
            <section className="profile-card profile-danger-card">
              <span><Trash2 size={20} /></span>
              <div><BodyText as="strong" weight={500}>Удаление аккаунта</BodyText><DescriptionText as="p">Удаление профиля является окончательным действием. Все ваши объявления, переписка и бронирования будут безвозвратно удалены.</DescriptionText></div>
              <Button size="sm" mode="outline" tone="danger" stretched startIcon={<Trash2 />} onClick={onOpenDelete}>Удалить профиль</Button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
