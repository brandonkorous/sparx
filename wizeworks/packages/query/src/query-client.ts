import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

// Default cache behaviour for every sparx QueryClient.
//
// A non-zero `staleTime` matters under App Router SSR: data prefetched on the
// server and dehydrated into the client must NOT refetch the instant it mounts,
// which would waste a request and flash a loading state right after hydration.
// One minute is a safe floor; individual queries override it when they need
// fresher or more cacheable data.
/**
 * The HTTP status behind a rejection, when there is one.
 *
 * Read structurally rather than by importing `ApiError`, so this package gains
 * no dependency on the client that throws it — the shape (`status: number`) is
 * the whole contract and it is stable.
 */
function httpStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

/**
 * Retry what might succeed next time, and nothing else.
 *
 * A 4xx was refused for a reason that is still true a second later, so retrying
 * one buys nothing — and it costs something real: a retry that cannot start is
 * held as `fetchStatus: 'paused'`, which leaves `status` on `pending`. A pane
 * branching on `isError` never gets its turn and shows its waiting state
 * forever, which is how an order that did not exist sat on "Just a moment…"
 * indefinitely (persona issue 287).
 *
 * 408 and 429 are the two that genuinely change on their own. An error with no
 * status at all is a network failure, which is exactly what retries are for.
 */
function retryWorthMaking(failureCount: number, error: unknown): boolean {
  const status = httpStatus(error);
  if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return false;
  }
  return failureCount < 2;
}

export const DEFAULT_QUERY_OPTIONS: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: retryWorthMaking,
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
