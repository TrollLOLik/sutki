import { BadgeCheck, CalendarCheck2, Sparkles, type LucideIcon } from 'lucide-react';
import type { ListingStatusBadge as ListingStatus } from '@shared/data/listings';
import { BadgeText } from '@ui';

const STATUS_META = {
  available_today: { label: 'Свободно сегодня', Icon: CalendarCheck2 },
  verified: { label: 'Проверено', Icon: BadgeCheck },
  new: { label: 'Новое', Icon: Sparkles },
} satisfies Record<ListingStatus, { label: string; Icon: LucideIcon }>;

export function ListingStatusBadge({
  status,
  className = '',
}: {
  status: ListingStatus;
  className?: string;
}) {
  const { label, Icon } = STATUS_META[status];

  return (
    <span className={`listing-status-badge ${status} ${className}`.trim()}>
      <Icon size={12} />
      <BadgeText truncate color="inherit">{label}</BadgeText>
    </span>
  );
}
