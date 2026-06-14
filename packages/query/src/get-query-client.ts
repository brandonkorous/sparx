import { isServer, type QueryClient } from '@tanstack/react-query';

import { makeQueryClient } from './query-client';

// Browser singleton — survives client-side navigations so the cache (and any
// in-flight queries) persist across route changes.
let browserQueryClient: QueryClient | undefined;

/**
 * Isomorphic QueryClient accessor used by the client-side <QueryProvider>.
 *
 * - On the **server**, returns a fresh client per call so requests never share
 *   cache. (For server-side *prefetch* across multiple Server Components in one
 *   request, use the cache()-backed `getServerQueryClient` from
 *   `@sparx/query/server` instead, so they dehydrate as one.)
 * - In the **browser**, returns a lazily-created singleton.
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
