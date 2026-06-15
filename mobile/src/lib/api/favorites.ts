import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { ListingsPage } from '@/types/listing';

export interface ListFavoritesParams {
  limit?: number;
  offset?: number;
}

interface FavoriteIDsResponse {
  ids: number[];
}

export const favoriteKeys = {
  all: ['favorites'] as const,
  list: (params: ListFavoritesParams) => [...favoriteKeys.all, 'list', params] as const,
  ids: () => [...favoriteKeys.all, 'ids'] as const,
};

function buildQuery(params: ListFavoritesParams): string {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** A page of my favorited listings (active only), newest first. */
export function fetchFavorites(params: ListFavoritesParams = {}): Promise<ListingsPage> {
  return api.get<ListingsPage>(`/api/v1/favorites${buildQuery(params)}`);
}

/** All house IDs I have favorited — used to render heart state across screens. */
export function fetchFavoriteIds(): Promise<number[]> {
  return api.get<FavoriteIDsResponse>('/api/v1/favorites/ids').then((res) => res.ids ?? []);
}

export function addFavorite(listingId: number): Promise<void> {
  return api.post<void>(`/api/v1/listings/${listingId}/favorite`);
}

export function removeFavorite(listingId: number): Promise<void> {
  return api.delete<void>(`/api/v1/listings/${listingId}/favorite`);
}

export function useFavorites(params: ListFavoritesParams = {}) {
  return useQuery({
    queryKey: favoriteKeys.list(params),
    queryFn: () => fetchFavorites(params),
    placeholderData: keepPreviousData,
  });
}

/** The set of favorited listing IDs, for O(1) heart-state lookups. */
export function useFavoriteIds() {
  return useQuery({
    queryKey: favoriteKeys.ids(),
    queryFn: fetchFavoriteIds,
    select: (ids) => new Set(ids),
  });
}

/**
 * Toggle a listing's favorite state. Optimistically updates the cached ID set so
 * the heart flips instantly, rolls back on error, and revalidates favorites
 * (list + ids) once the mutation settles.
 */
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: number; isFavorite: boolean }) =>
      isFavorite ? removeFavorite(id) : addFavorite(id),
    onMutate: async ({ id, isFavorite }) => {
      await qc.cancelQueries({ queryKey: favoriteKeys.ids() });
      const previous = qc.getQueryData<number[]>(favoriteKeys.ids());
      qc.setQueryData<number[]>(favoriteKeys.ids(), (ids) => {
        const without = (ids ?? []).filter((x) => x !== id);
        return isFavorite ? without : [id, ...without];
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(favoriteKeys.ids(), ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: favoriteKeys.all }),
  });
}
