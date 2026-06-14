'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { getQueryClient } from './get-query-client';

/**
 * Mount once near the root of each app (inside the root layout's client tree).
 *
 * Owns the browser QueryClient singleton; server-prefetched queries hydrate into
 * it via `<HydrationBoundary>` rendered deeper in the (server) tree. The
 * devtools panel is dev-only — the guard is statically eliminated from
 * production bundles.
 */
export function QueryProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  // getQueryClient() already memoises the browser instance, so calling it on each
  // render is cheap and avoids the Suspense double-render footgun of useState.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV !== 'production' ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
