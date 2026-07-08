import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export interface HostResponseStats {
  avg_response_minutes: number;
  responses_count: number;
}

export const hostStatsKeys = {
  all: ['host-stats'] as const,
  response: (hostId: number) => [...hostStatsKeys.all, hostId, 'response'] as const,
};

export function fetchHostResponseStats(hostId: number): Promise<HostResponseStats> {
  return api.get<HostResponseStats>(`/api/v1/users/${hostId}/host-response-stats`, {
    auth: false,
  });
}

export function useHostResponseStats(hostId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: hostStatsKeys.response(hostId ?? 0),
    queryFn: () => fetchHostResponseStats(hostId as number),
    enabled: enabled && hostId != null && hostId > 0,
    staleTime: 5 * 60 * 1000,
  });
}
