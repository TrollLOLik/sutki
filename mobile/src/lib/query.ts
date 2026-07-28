import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/client';

function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

/**
 * Shared React Query client. Tuned for mobile networks (offline-first per
 * TZ §5): cached data stays fresh for a minute. Requests still execute while
 * React Query considers the device offline so screens can leave their loading
 * state and show an actionable error. Network failures are not retried until
 * connectivity is restored; other transient reads keep two retries.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      networkMode: 'always',
      retry: (failureCount, error) => !isNetworkError(error) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: 'always',
      retry: 0,
    },
  },
});
