import { QueryClient, environmentManager, type QueryClientConfig } from '@tanstack/react-query';

import { keepFailedReadsMoving, mightSucceedLater } from './recovery';

// Default cache behaviour for every sparx QueryClient.
//
// A non-zero `staleTime` matters under App Router SSR: data prefetched on the
// server and dehydrated into the client must NOT refetch the instant it mounts,
// which would waste a request and flash a loading state right after hydration.
// One minute is a safe floor; individual queries override it when they need
// fresher or more cacheable data.
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
 * What it means to "might succeed later" lives in recovery.ts, so the retry and
 * the background probe can never disagree about it.
 */
function retryWorthMaking(failureCount: number, error: unknown): boolean {
  if (!mightSucceedLater(error)) return false;
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

/**
 * A client with the sparx defaults. In the browser it also keeps a failed read
 * moving until it has an answer (see recovery.ts): a retry is never held for
 * ever because the page reports itself hidden, and a read that failed while the
 * API was down asks again until the API answers. That is what stops a pane
 * sitting on "Loading…", and the shell on "Reconnecting", after the API is back
 * (sparx persona issue 086). On a server neither applies, and a background
 * probe would outlive the request.
 */
export function makeQueryClient(): QueryClient {
  const client = new QueryClient(DEFAULT_QUERY_OPTIONS);
  if (!environmentManager.isServer()) keepFailedReadsMoving(client);
  return client;
}
