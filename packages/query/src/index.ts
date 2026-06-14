// @sparx/query — the blessed client data layer (TanStack Query).
//
// ONE import source for client-interactive server state. Re-exports the full
// TanStack Query surface (hooks, types, QueryClient, dehydrate, HydrationBoundary,
// isServer, …) alongside the Sparx setup so feature code imports everything from
// `@sparx/query` rather than reaching for `@tanstack/react-query` directly.
//
// - The client <QueryProvider> lives at the `@sparx/query/provider` subpath
//   (it carries 'use client'), keeping this barrel safe to import from RSCs.
// - The server-only SSR-prefetch helper lives at `@sparx/query/server`.
//
// Boundary rule: server-first by default (RSC reads, server-action writes).
// Reach for these hooks only for data that is client-owned and changes after
// load. See docs/95-client-data-fetching.md.
export * from '@tanstack/react-query';

export { makeQueryClient, DEFAULT_QUERY_OPTIONS } from './query-client';
export { getQueryClient } from './get-query-client';
export { queryKeys } from './keys';
