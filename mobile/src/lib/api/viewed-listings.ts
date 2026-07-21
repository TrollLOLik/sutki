import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { readLocalViewedListings, rememberLocalViewedListing } from '@/lib/localViewedListings';
import { useIsGuest } from '@/store/session';

interface ViewedListingIDsResponse {
  ids: number[];
}

export const viewedListingKeys = {
  all: ['viewed-listings'] as const,
  ids: (isGuest: boolean) => [...viewedListingKeys.all, 'ids', isGuest] as const,
};

export function fetchViewedListingIds(): Promise<number[]> {
  return api
    .get<ViewedListingIDsResponse>('/api/v1/me/viewed-listings/ids')
    .then((response) => response.ids ?? []);
}

export function useViewedListingIds() {
  const isGuest = useIsGuest();
  return useQuery({
    queryKey: viewedListingKeys.ids(isGuest),
    queryFn: async () => {
      if (isGuest) {
        return (await readLocalViewedListings()).map((item) => item.id);
      }
      return fetchViewedListingIds();
    },
    select: (ids) => new Set(ids),
  });
}

export function useRememberViewedListing() {
  const isGuest = useIsGuest();
  const queryClient = useQueryClient();

  return useCallback(
    async (id: number) => {
      const key = viewedListingKeys.ids(isGuest);
      queryClient.setQueryData<number[]>(key, (ids) => [id, ...(ids ?? []).filter((item) => item !== id)]);
      if (isGuest) {
        await rememberLocalViewedListing(id);
      }
    },
    [isGuest, queryClient],
  );
}
