import { CheckCircle2, Clock3, Expand, Home, MapPin, MessageCircle, Phone, Star } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import type { ChatUser, Conversation } from '@features/chat';
import type { ListingOwner } from '@shared/data/listings';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { BadgeText, BodyText, Button, ButtonLink, DescriptionText, HeroTitle, IconButton, Stat } from '@ui';

type PublicProfileUser = ListingOwner | ChatUser;

function compactResponseTime(value?: string) {
  return value?.replace(/^Обычно отвечает\s*/i, '').trim() || 'Нет данных';
}

interface PublicProfileOverviewProps {
  user: PublicProfileUser;
  conversation?: Conversation;
  listingsCount: number;
  children?: ReactNode;
  actionsRef: Ref<HTMLDivElement>;
  onOpenAvatar: () => void;
  onOpenReviews: () => void;
  onOpenConversation: () => void;
}

function PublicProfileContactActions({ user, conversation, tabIndex, onOpenConversation }: { user: PublicProfileUser; conversation?: Conversation; tabIndex?: number; onOpenConversation: () => void }) {
  return (
    <>
      {user.phone ? <ButtonLink href={'tel:' + user.phone} size="md" mode="solid" tone="primary" startIcon={<Phone />} tabIndex={tabIndex}>Позвонить</ButtonLink> : null}
      {conversation ? <Button size="md" mode="outline" tone="neutral" stretched startIcon={<MessageCircle />} tabIndex={tabIndex} onClick={onOpenConversation}>Написать</Button> : null}
    </>
  );
}

export function PublicProfileOverview(props: PublicProfileOverviewProps) {
  const { user } = props;
  const desktop = useMediaQuery('(min-width: 900px)');
  const hero = (
      <section className="public-profile-hero">
        <div className="public-profile-hero-content">
          <IconButton variant="plain" className="public-profile-avatar" label="Открыть фото профиля" icon={<>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <BodyText as="b" color="inherit">{user.surname.slice(0, 1)}{user.name.slice(0, 1)}</BodyText>}<em aria-hidden="true"><Expand size={14} /></em></>} onClick={props.onOpenAvatar} />
          <div className="public-profile-hero-copy">
            <BadgeText className="public-profile-badge">ВИГАЖ</BadgeText>
            <HeroTitle truncate>{user.surname} {user.name}</HeroTitle>
            <BodyText as="p" color="secondary"><MapPin size={15} /><BodyText color="inherit" truncate>{user.city || 'Город не указан'}</BodyText></BodyText>
            <DescriptionText as="small" truncate>{user.memberSince || 'Пользователь сервиса'}</DescriptionText>
          </div>
        </div>
      </section>
  );
  const metrics = (
      <section className="public-profile-metrics" aria-label="Информация о пользователе">
        <Stat wrapCopy={false} icon={<Home size={19} />} value={props.listingsCount} label="Объявления" />
        <Stat wrapCopy={false} icon={<Star size={19} />} value={user.rating ? user.rating.toFixed(1) : '—'} label={user.reviewsCount ? user.reviewsCount + ' отзывов' : 'Нет оценок'} onClick={props.onOpenReviews} />
        <Stat wrapCopy={false} icon={<CheckCircle2 size={19} />} value={user.phone ? 'Подтверждён' : 'Не указан'} label="Номер телефона" />
        <Stat wrapCopy={false} icon={<Clock3 size={19} />} value={compactResponseTime(user.responseTime)} label="Среднее время ответа" />
      </section>
  );
  const actions = (
      <div ref={props.actionsRef} className="public-profile-actions">
        <PublicProfileContactActions user={user} conversation={props.conversation} onOpenConversation={props.onOpenConversation} />
      </div>
  );

  if (desktop) {
    return (
      <div className="public-profile-detail-layout">
        <div className="public-profile-detail-primary">{hero}{props.children}</div>
        <aside className="public-profile-detail-summary">{metrics}{actions}</aside>
      </div>
    );
  }

  return <>{hero}{metrics}{actions}{props.children}</>;
}

export function PublicProfileStickyActions({ user, conversation, visible, onOpenConversation }: { user: PublicProfileUser; conversation?: Conversation; visible: boolean; onOpenConversation: () => void }) {
  return (
    <div className={`public-profile-sticky-actions ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <PublicProfileContactActions user={user} conversation={conversation} tabIndex={visible ? 0 : -1} onOpenConversation={onOpenConversation} />
    </div>
  );
}
