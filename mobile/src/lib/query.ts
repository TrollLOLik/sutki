import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client. Tuned for mobile networks (offline-first per
 * TZ §5): cached data stays fresh for a minute and failed reads retry twice.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
