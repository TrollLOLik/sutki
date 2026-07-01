import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { env } from '@/lib/env';

/**
 * City autocomplete backed by the DaData proxy (POST /api/v1/cities/suggest).
 * The endpoint returns an empty list when DADATA_API_KEY is unset on the
 * server, so callers should treat an empty result as "no suggestions".
 *
 * Shared by the create-listing form, the filters city picker and the search
 * overlay so the suggest call lives in one place.
 */
export async function suggestCities(query: string, signal?: AbortSignal): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  try {
    const res = await fetch(`${env.apiUrl}/api/v1/cities/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: trimmed,
        from_bound: { value: 'city' },
        to_bound: { value: 'city' },
      }),
      signal,
    });
    const data = await res.json();
    if (data?.suggestions) {
      return (data.suggestions as any[])
        .map((s) => s?.data?.city)
        .filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    }
  } catch (err) {
    const error = err as Error | undefined;
    const isAbort =
      error?.name === 'AbortError' ||
      error?.message?.toLowerCase().includes('cancel') ||
      error?.message?.toLowerCase().includes('abort');
    if (!isAbort) {
      console.error('City suggest error:', err);
    }
  }
  return [];
}

export const cityKeys = {
  suggest: (query: string) => ['cities', 'suggest', query] as const,
};

/** Debounce-friendly hook around suggestCities; pass the (already debounced) query. */
export function useCitySuggestions(query: string) {
  const enabled = query.trim().length > 0;
  return useQuery({
    queryKey: cityKeys.suggest(query.trim()),
    queryFn: ({ signal }) => suggestCities(query, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });
}

export interface DaDataSuggestion {
  value: string;
  unrestricted_value: string;
  data: {
    city?: string | null;
    street?: string | null;
    house?: string | null;
    geo_lat?: string | null;
    geo_lon?: string | null;
    qc_geo?: string | null;
  };
}

/**
 * Autocomplete for streets and houses using the DaData proxy.
 * Restricts queries by city/street contexts.
 */
export async function suggestAddress(
  query: string,
  bounds: 'street' | 'house',
  cityContext?: string,
  streetContext?: string,
  signal?: AbortSignal
): Promise<DaDataSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const locations: any[] = [];
  if (cityContext) {
    locations.push({ city: cityContext });
  }
  // If we have street context, DaData recommends restricting it inside locations
  if (streetContext && cityContext) {
    locations[0] = { city: cityContext, street: streetContext };
  }

  try {
    const res = await fetch(`${env.apiUrl}/api/v1/cities/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: trimmed,
        locations: locations.length > 0 ? locations : undefined,
        from_bound: { value: bounds },
        to_bound: { value: bounds },
      }),
      signal,
    });
    const data = await res.json();
    if (data?.suggestions) {
      return data.suggestions as DaDataSuggestion[];
    }
  } catch (err) {
    const error = err as Error | undefined;
    const isAbort =
      error?.name === 'AbortError' ||
      error?.message?.toLowerCase().includes('cancel') ||
      error?.message?.toLowerCase().includes('abort');
    if (!isAbort) {
      console.error(`Address suggest error for ${bounds}:`, err);
    }
  }
  return [];
}

