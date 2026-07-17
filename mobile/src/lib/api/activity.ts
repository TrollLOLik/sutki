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
}

export const activityKeys = {
  all: ['activity'] as const,
  counters: () => [...activityKeys.all, 'counters'] as const,
};

export function useActivityCounters(enabled = true) {
  return useQuery({
    queryKey: activityKeys.counters(),
    queryFn: () => api.get<ActivityCounters>('/api/v1/me/activity'),
    enabled,
    staleTime: 15_000,
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
