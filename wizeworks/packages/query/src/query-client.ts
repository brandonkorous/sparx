import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

// Default cache behaviour for every sparx QueryClient.
//
// A non-zero `staleTime` matters under App Router SSR: data prefetched on the
// server and dehydrated into the client must NOT refetch the instant it mounts,
// which would waste a request and flash a loading state right after hydration.
// One minute is a safe floor; individual queries override it when they need
// fresher or more cacheable data.
export const DEFAULT_QUERY_OPTIONS: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutations are user-intentful writes (usually wrapping a server action) —
      // silently retrying a failed write is the wrong default. Opt in per call.
      retry: 0,
    },
  },
};

export function makeQueryClient(): QueryClient {
  return new QueryClient(DEFAULT_QUERY_OPTIONS);
}
