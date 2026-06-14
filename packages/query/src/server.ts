import 'server-only';

import { cache } from 'react';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { makeQueryClient } from './query-client';

/**
 * Per-request QueryClient for Server Components.
 *
 * React's `cache()` dedupes within a single request render tree, so every
 * Server Component that calls this during one request gets the *same* client —
 * they can each `prefetchQuery(...)` into it, then one `dehydrate(...)` ships
 * the combined cache to the browser via `<HydrationBoundary>`.
 *
 * Never import this from a Client Component — `import 'server-only'` makes that
 * a build error rather than a subtle bundle leak.
 */
export const getServerQueryClient = cache(makeQueryClient);

// Re-exported here so a Server Component can prefetch + hand off without a second
// import from '@tanstack/react-query'. `<HydrationBoundary>` is a client boundary
// rendered from the server — the canonical App Router SSR handoff.
export { dehydrate, HydrationBoundary };
