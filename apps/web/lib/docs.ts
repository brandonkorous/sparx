/**
 * Docs navigation registry — the single source of truth for the developer
 * documentation at sparx.works/docs.
 *
 * The sidebar, the sitemap, llms.txt, and (eventually) prev/next pagers all
 * read from `DOC_NAV`, so the navigation can never drift from what actually
 * ships — the same pattern lib/modules.ts uses for the module marketing pages.
 *
 * `soon: true` marks a planned page that has no route yet. It renders as a
 * disabled sidebar item (not a link), so the full information architecture is
 * visible without 404ing into pages that don't exist. As each page lands, drop
 * the `soon` flag and add the route under app/docs/.
 */

export type DocBadge = 'new' | 'beta' | 'soon';

export interface DocLink {
  title: string;
  /** Absolute path from the site root, e.g. `/docs/quickstart`. */
  href: string;
  /** Optional pill shown after the title in the sidebar. */
  badge?: DocBadge;
  /** Planned but not yet routed — rendered disabled, excluded from sitemap. */
  soon?: boolean;
}

export interface DocGroup {
  /** Stable key (also the section's URL segment where applicable). */
  key: string;
  title: string;
  links: DocLink[];
}

export const DOC_NAV: DocGroup[] = [
  {
    key: 'guides',
    title: 'Guides',
    links: [
      { title: 'Introduction', href: '/docs' },
      { title: 'Quickstart', href: '/docs/quickstart' },
      { title: 'Authentication', href: '/docs/authentication' },
      { title: 'Core concepts', href: '/docs/concepts' },
      { title: 'Modules & billing', href: '/docs/modules', soon: true },
      { title: 'Building a site', href: '/docs/guides/building-a-site', soon: true },
      { title: 'Building a template', href: '/docs/guides/building-a-template' },
      { title: 'Webhooks & events', href: '/docs/guides/webhooks' },
      {
        title: 'Multi-property sites',
        href: '/docs/guides/multi-property',
        badge: 'new',
        soon: true,
      },
      { title: 'Migrating to Sparx', href: '/docs/guides/migrating', soon: true },
    ],
  },
  {
    key: 'api',
    title: 'API reference',
    links: [
      { title: 'REST overview', href: '/docs/api', soon: true },
      { title: 'Create an order', href: '/docs/api/orders/create' },
      { title: 'GraphQL schema', href: '/docs/api/graphql', soon: true },
      { title: 'Pagination', href: '/docs/api/pagination', soon: true },
      { title: 'Errors & status codes', href: '/docs/api/errors', soon: true },
      { title: 'Rate limits', href: '/docs/api/rate-limits', soon: true },
    ],
  },
  {
    key: 'sdks',
    title: 'SDKs',
    links: [
      { title: 'Builder SDK', href: '/docs/sdks/builder', soon: true },
      { title: 'TypeScript types', href: '/docs/sdks/typescript', soon: true },
      { title: 'Self-hosting', href: '/docs/sdks/self-host', badge: 'soon', soon: true },
    ],
  },
  {
    key: 'mcp',
    title: 'MCP',
    links: [
      { title: 'MCP server', href: '/docs/mcp', soon: true },
      { title: 'Tools & resources', href: '/docs/mcp/tools', badge: 'beta', soon: true },
    ],
  },
  {
    key: 'changelog',
    title: 'Changelog',
    links: [{ title: 'Release notes', href: '/docs/changelog', soon: true }],
  },
];

/** Every docs page that actually has a route — used by the sitemap + llms.txt. */
export const DOC_PAGES: DocLink[] = DOC_NAV.flatMap((g) => g.links).filter((l) => !l.soon);
