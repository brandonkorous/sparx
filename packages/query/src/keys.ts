// Centralised query-key factory — the single registry of every TanStack Query
// key in the app. Keeping them here (greppable in one file) means a query and
// the mutation that invalidates it can't silently drift apart. Convention:
//
//   queryKeys.<domain>.<entity>(args) -> readonly tuple
//
// A query and its invalidator MUST derive their key from the same factory call —
// never hand-write a key array at a call site.
export const queryKeys = {
  /** Deployed app version, polled by the refresh-notifier. */
  appVersion: () => ['app', 'version'] as const,

  search: {
    /** Universal (⌘K) search across all entity types for a query string. */
    all: (query: string) => ['search', 'all', query] as const,
  },

  /** Fitment vocabulary cascade (B2B fleet editor): domain → category → item → variant. */
  fitment: {
    domains: () => ['fitment', 'domains'] as const,
    categories: (domainId: string) => ['fitment', 'categories', domainId] as const,
    items: (categoryId: string) => ['fitment', 'items', categoryId] as const,
    variants: (itemId: string) => ['fitment', 'variants', itemId] as const,
  },
} as const;
