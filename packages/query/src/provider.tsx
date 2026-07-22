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
export function QueryProvider({
  children,
  devtools = true,
  devtoolsButtonPosition = 'bottom-left',
}: {
  children: React.ReactNode;
  /**
   * Mount the dev-only devtools at all. Default `true`.
   *
   * Pass `false` in an app where the floating toggle is more nuisance than
   * help — it is a fixed-position button that sits over whatever the app puts
   * in that corner, and there is no way to keep the panel while hiding its
   * launcher. Production never renders it either way.
   */
  devtools?: boolean;
  /** Where the dev-only devtools toggle floats. Apps whose bottom-left corner
   *  is real UI (the workbench's rail footer + status bar) move it. */
  devtoolsButtonPosition?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}): React.ReactElement {
  // getQueryClient() already memoises the browser instance, so calling it on each
  // render is cheap and avoids the Suspense double-render footgun of useState.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {devtools && process.env.NODE_ENV !== 'production' ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition={devtoolsButtonPosition} />
      ) : null}
    </QueryClientProvider>
  );
}
