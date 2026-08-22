import { CalendarDays, CheckCircle2, ChevronRight, CircleX, Clock3, Inbox, MessageCircle, Star, type LucideIcon } from 'lucide-react';
import type { AppNotification } from '@features/notifications';
import { BadgeText, BodyText, DescriptionText, Pressable } from '@ui';

const scopeIcons: Record<AppNotification['scope'], LucideIcon> = {
  messages: MessageCircle,
  incoming: Inbox,
  bookings: CalendarDays,
  listings: CheckCircle2,
  reviews: Star,
};

export function NotificationRow({ item, onOpen }: { item: AppNotification; onOpen: () => void }) {
  const Icon = item.action === 'rejected' ? CircleX : item.action === 'pending' ? Clock3 : scopeIcons[item.scope];
  return <article className={`notification-card tone-${item.tone} ${item.read ? 'is-read' : 'is-unread'}`}><Pressable onClick={onOpen} aria-label={`${item.title}. ${item.body}`}><span className="notification-icon"><Icon size={22} /></span><span className="notification-copy"><span className="notification-title"><BodyText as="strong" weight={item.read ? 400 : 500}>{item.title}</BodyText>{!item.read ? <i /> : null}</span><DescriptionText className="notification-body">{item.body}</DescriptionText><span className="notification-meta"><BadgeText as="small" weight={400} color="muted">{item.dateLabel}</BadgeText><ChevronRight size={16} /></span></span></Pressable></article>;
}
