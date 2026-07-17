import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export type ActivityScope = 'bookings' | 'incoming' | 'listings' | 'reviews';

export interface ActivityCounters {
  messages: number;
  bookings: number;
  incoming: number;
  listings: number;
  reviews: number;
  profile: number;
  notifications: number;
}

export interface UserNotification {
  id: number;
  scope: ActivityScope | 'messages';
  type: string;
  entity_id?: number;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at?: string;
}

export interface NotificationsPage {
  items: UserNotification[];
  total: number;
  limit: number;
  offset: number;
}

export const activityKeys = {
  all: ['activity'] as const,
  counters: () => [...activityKeys.all, 'counters'] as const,
  notifications: () => [...activityKeys.all, 'notifications'] as const,
};

export function useActivityCounters(enabled = true) {
  return useQuery({
    queryKey: activityKeys.counters(),
    queryFn: () => api.get<ActivityCounters>('/api/v1/me/activity'),
    enabled,
    staleTime: 15_000,
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: activityKeys.notifications(),
    queryFn: () => api.get<NotificationsPage>('/api/v1/me/notifications?limit=100'),
    enabled,
    staleTime: 15_000,
  });
}

function markNotificationLocally(
  page: NotificationsPage | undefined,
  predicate: (item: UserNotification) => boolean,
): NotificationsPage | undefined {
  if (!page) return page;
  const now = new Date().toISOString();
  return { ...page, items: page.items.map((item) => predicate(item) ? { ...item, read_at: item.read_at ?? now } : item) };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<void>(`/api/v1/me/notifications/${id}/read`),
    onMutate: (id) => {
      queryClient.setQueryData<NotificationsPage>(activityKeys.notifications(), (page) =>
        markNotificationLocally(page, (item) => item.id === id));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: activityKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/api/v1/me/notifications/read'),
    onMutate: () => {
      queryClient.setQueryData<NotificationsPage>(activityKeys.notifications(), (page) =>
        markNotificationLocally(page, () => true));
      queryClient.setQueryData<ActivityCounters>(activityKeys.counters(), (counters) =>
        counters ? { ...counters, notifications: 0, profile: 0, bookings: 0, incoming: 0, listings: 0, reviews: 0 } : counters);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: activityKeys.all }),
  });
}

export function useMarkActivityRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scope: ActivityScope) =>
      api.post<void>(`/api/v1/me/activity/${scope}/read`),
    onMutate: async (scope) => {
      await queryClient.cancelQueries({ queryKey: activityKeys.counters() });
      const previous = queryClient.getQueryData<ActivityCounters>(activityKeys.counters());
      if (previous) {
        queryClient.setQueryData<ActivityCounters>(activityKeys.counters(), {
          ...previous,
          [scope]: 0,
          profile: Math.max(0, previous.profile - previous[scope]),
        });
      }
      return { previous };
    },
    onError: (_error, _scope, context) => {
      if (context?.previous) {
        queryClient.setQueryData(activityKeys.counters(), context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: activityKeys.counters() }),
  });
}
