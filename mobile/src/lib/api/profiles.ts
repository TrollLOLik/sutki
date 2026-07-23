import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { PublicUser } from '@/types/user';

export const profileKeys = {
  all: ['profiles'] as const,
  public: (userId: number) => [...profileKeys.all, 'public', userId] as const,
};

export function fetchPublicProfile(userId: number): Promise<PublicUser> {
  return api.get<PublicUser>(`/api/v1/users/${userId}`, { auth: false });
}

export function usePublicProfile(userId: number | undefined) {
  return useQuery({
    queryKey: profileKeys.public(userId ?? 0),
    queryFn: () => fetchPublicProfile(userId as number),
    enabled: userId != null && Number.isFinite(userId) && userId > 0,
    staleTime: 5 * 60 * 1000,
  });
}
