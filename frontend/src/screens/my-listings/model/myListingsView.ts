import type { OwnerListingStatus } from '@features/my-listings';

export type MyListingsTab = 'all' | 'active' | 'pending' | 'unpublished' | 'rejected';
export type MyListingsFilterStatus = OwnerListingStatus | 'review';

export const myListingsTabScrollPositions: Record<MyListingsTab | 'custom', number> = {
  all: 0,
  active: 0,
  pending: 0,
  unpublished: 0,
  rejected: 0,
  custom: 0,
};

export const quickStatuses: Array<{ value: MyListingsTab; label: string; statuses: MyListingsFilterStatus[] }> = [
  { value: 'all', label: 'Все', statuses: [] },
  { value: 'active', label: 'В поиске', statuses: ['active'] },
  { value: 'pending', label: 'На проверке', statuses: ['pending_moderation'] },
  { value: 'unpublished', label: 'Снятые', statuses: ['unpublished'] },
  { value: 'rejected', label: 'Отклонённые', statuses: ['rejected'] },
];

export const statusOptions: Array<{ value: MyListingsFilterStatus; label: string }> = [
  { value: 'active', label: 'Опубликовано' },
  { value: 'unpublished', label: 'Снято' },
  { value: 'pending_moderation', label: 'На проверке' },
  { value: 'review', label: 'Доп. проверка' },
  { value: 'rejected', label: 'Отклонено' },
];

export function statusesForTab(tab: MyListingsTab): MyListingsFilterStatus[] {
  return quickStatuses.find((item) => item.value === tab)?.statuses ?? [];
}

export function sameStatuses(left: readonly MyListingsFilterStatus[], right: readonly MyListingsFilterStatus[]) {
  return left.length === right.length && left.every((status) => right.includes(status));
}
