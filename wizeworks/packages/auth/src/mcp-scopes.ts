// MCP OAuth scope vocabulary (docs/07 §5).
//
// This is the SINGLE source of truth for the scopes an MCP OAuth connection can
// carry. The `@better-auth/mcp` provider advertises + allows exactly these
// (server.ts), the consent page renders them as the scope picker, and the
// resource server (api-mcp) gates each tool on them. Keep in lockstep with the
// tool registry's `McpScope` union.
//
// Pure (no Better Auth / DB imports), so server.ts can use it without an import
// cycle. The consent proof that used to live here (the `sparx_grant` HMAC) is
// gone: on 1.7 the provider itself refuses to mint a code until the person has
// approved on /oauth2/consent, so there is no side door left to close.

/** OIDC framing scopes — always granted, never user-toggled. `offline_access`
 *  is what makes Better Auth return a refresh token. */
export const OIDC_BASE_SCOPES = ['openid', 'offline_access'] as const;

export type McpBusinessScope =
  | 'read:crm'
  | 'write:crm'
  | 'write:crm_bulk'
  | 'read:commerce'
  | 'write:commerce'
  | 'write:commerce_bulk'
  | 'read:inventory'
  | 'write:inventory'
  | 'read:builder'
  | 'write:builder'
  | 'read:cms'
  | 'write:cms'
  | 'read:email'
  | 'write:email'
  | 'write:email_bulk'
  | 'read:search'
  | 'write:search'
  | 'read:automations'
  | 'write:automations'
  | 'read:domains'
  | 'write:domains'
  | 'read:invoicing'
  | 'write:invoicing'
  | 'read:scheduling'
  | 'write:scheduling'
  | 'read:b2b'
  | 'write:b2b'
  | 'read:social'
  | 'write:social'
  | 'read:funnels'
  | 'write:funnels';

export interface McpScopeMeta {
  scope: McpBusinessScope;
  module: string;
  kind: 'read' | 'write';
  label: string;
  description: string;
  /** Bulk/destructive scopes get a heavier warning + are owner/admin-only. */
  sensitive?: boolean;
}

/** Consent-page catalog: ordered, grouped by module, human-readable. */
export const MCP_SCOPE_CATALOG: readonly McpScopeMeta[] = [
  {
    scope: 'read:crm',
    module: 'CRM',
    kind: 'read',
    label: 'Read CRM',
    description: 'View customers, deals, tasks, and activity.',
  },
  {
    scope: 'write:crm',
    module: 'CRM',
    kind: 'write',
    label: 'Manage CRM',
    description: 'Create/update customers, deals, tasks, and notes.',
  },
  {
    scope: 'write:crm_bulk',
    module: 'CRM',
    kind: 'write',
    label: 'Bulk CRM actions',
    description: 'Bulk assign/tag/segment customers.',
    sensitive: true,
  },
  {
    scope: 'read:commerce',
    module: 'Commerce',
    kind: 'read',
    label: 'Read commerce',
    description: 'View products, orders, revenue, and reports.',
  },
  {
    scope: 'write:commerce',
    module: 'Commerce',
    kind: 'write',
    label: 'Manage commerce',
    description: 'Publish products, issue credits, manage subscriptions.',
  },
  {
    scope: 'write:commerce_bulk',
    module: 'Commerce',
    kind: 'write',
    label: 'Bulk commerce actions',
    description: 'Bulk product/status changes and pricing sweeps.',
    sensitive: true,
  },
  {
    scope: 'read:inventory',
    module: 'Inventory',
    kind: 'read',
    label: 'Read inventory',
    description: 'View stock levels, valuation, and reorder suggestions.',
  },
  {
    scope: 'write:inventory',
    module: 'Inventory',
    kind: 'write',
    label: 'Manage inventory',
    description: 'Adjust stock, draft POs, and receive stock.',
  },
  {
    scope: 'read:builder',
    module: 'Site Builder',
    kind: 'read',
    label: 'Read site',
    description: 'View themes, sections, pages, and published site.',
  },
  {
    scope: 'write:builder',
    module: 'Site Builder',
    kind: 'write',
    label: 'Edit site',
    description: 'Edit sections/pages, publish, and roll back the site.',
  },
  // Content (docs/12). These were MISSING from this catalog while ten CMS tools in
  // the registry already required them and api-mcp already mapped them to the `cms`
  // module gate — so the whole content surface was unreachable over MCP on BOTH auth
  // paths at once: the API-key dialog renders this catalog (so the scope could never
  // be picked) and MCP_ALL_OAUTH_SCOPES derives from it (so authorize rejected it).
  // A content-only tenant could not let an assistant touch their content at all.
  {
    scope: 'read:cms',
    module: 'Content',
    kind: 'read',
    label: 'Read content',
    description: 'View content types, entries, and drafts.',
  },
  {
    scope: 'write:cms',
    module: 'Content',
    kind: 'write',
    label: 'Manage content',
    description: 'Create and edit content types and entries, and publish them.',
  },
  {
    scope: 'read:email',
    module: 'Email',
    kind: 'read',
    label: 'Read email',
    description: 'View email stats, broadcasts, and merge tags.',
  },
  {
    scope: 'write:email',
    module: 'Email',
    kind: 'write',
    label: 'Send email',
    description: 'Create and send broadcasts to segments.',
  },
  {
    scope: 'write:email_bulk',
    module: 'Email',
    kind: 'write',
    label: 'Bulk email sends',
    description: 'Large broadcast sends across segments.',
    sensitive: true,
  },
  {
    scope: 'read:search',
    module: 'Search',
    kind: 'read',
    label: 'Search',
    description: 'Search products, customers, orders across the tenant.',
  },
  {
    scope: 'write:search',
    module: 'Search',
    kind: 'write',
    label: 'Rebuild the search index',
    description:
      'Rebuild the search index from your data when results have gone stale. Does not change any of your records.',
    sensitive: true,
  },
  {
    scope: 'read:automations',
    module: 'Automations',
    kind: 'read',
    label: 'Read automations',
    description: 'View automation rules and run history.',
  },
  {
    scope: 'write:automations',
    module: 'Automations',
    kind: 'write',
    label: 'Manage automations',
    description: 'Create, edit, enable/disable automations.',
  },
  {
    scope: 'read:domains',
    module: 'Domains',
    kind: 'read',
    label: 'Read domains',
    description: 'View domains and availability.',
  },
  {
    scope: 'write:domains',
    module: 'Domains',
    kind: 'write',
    label: 'Manage domains',
    description: 'Purchase and configure domains.',
    sensitive: true,
  },
  {
    scope: 'read:invoicing',
    module: 'Invoicing',
    kind: 'read',
    label: 'Read invoicing',
    description: 'View billing documents and workflows.',
  },
  {
    scope: 'write:invoicing',
    module: 'Invoicing',
    kind: 'write',
    label: 'Manage invoicing',
    description: 'Create billing documents, add lines, record payments.',
  },
  {
    scope: 'read:scheduling',
    module: 'Scheduling',
    kind: 'read',
    label: 'Read scheduling',
    description: 'View services, availability, and bookings.',
  },
  {
    scope: 'write:scheduling',
    module: 'Scheduling',
    kind: 'write',
    label: 'Manage scheduling',
    description: 'Create, reschedule, and cancel bookings.',
  },
  // B2B / wholesale (docs/10). MISSING here while the b2b tool registry already
  // required them and api-mcp mapped them to the `b2b` module gate — the same
  // catalog-lag defect the Content note above describes, so the whole trade
  // surface (pricing tiers, approvals, net-terms AR) was unreachable over MCP on
  // both auth paths at once.
  {
    scope: 'read:b2b',
    module: 'B2B',
    kind: 'read',
    label: 'Read B2B',
    description: 'View trade accounts, pricing tiers, the approval queue, and receivables.',
  },
  {
    scope: 'write:b2b',
    module: 'B2B',
    kind: 'write',
    label: 'Manage B2B',
    description:
      'Manage pricing tiers, account trade config, purchase approvals, and net-terms invoices.',
  },
  // Social (docs/133). Same catalog-lag defect — the social post + lifecycle tools
  // shipped requiring these while this catalog predated them.
  {
    scope: 'read:social',
    module: 'Social',
    kind: 'read',
    label: 'Read social',
    description: 'View social posts and their per-platform status.',
  },
  {
    scope: 'write:social',
    module: 'Social',
    kind: 'write',
    label: 'Manage social',
    description: 'Compose, schedule, approve, and publish social posts.',
  },
  // Funnels (docs/151). Added in the SAME change as the tools, deliberately: the
  // three notes above all record the same defect from the other direction — a
  // tool registry requiring a scope this catalog had never heard of, which makes
  // the whole surface unreachable on both auth paths while everything typechecks.
  {
    scope: 'read:funnels',
    module: 'Funnels',
    kind: 'read',
    label: 'Read campaigns',
    description: 'View campaigns, their stages, and how many people reached each one.',
  },
  {
    scope: 'write:funnels',
    module: 'Funnels',
    kind: 'write',
    label: 'Manage campaigns',
    description: 'Create and change campaigns, and record what happened to the people in them.',
  },
] as const;

export const MCP_BUSINESS_SCOPES: readonly McpBusinessScope[] = MCP_SCOPE_CATALOG.map(
  (s) => s.scope
);

/** Everything the OAuth provider advertises + allows (authorize rejects any
 *  requested scope outside this set). OIDC framing scopes first. */
export const MCP_ALL_OAUTH_SCOPES: readonly string[] = [
  ...OIDC_BASE_SCOPES,
  ...MCP_BUSINESS_SCOPES,
];

export type StaffRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'api';

/** The MOST a given staff role may grant to an MCP connection — defense in
 *  depth so a viewer can never mint a write-capable token even by tampering
 *  with the consent form. Mirrors api-mcp's DEFAULT_SCOPES_BY_ROLE. */
export function grantableScopesForRole(role: StaffRole): McpBusinessScope[] {
  const all = [...MCP_BUSINESS_SCOPES];
  switch (role) {
    case 'owner':
    case 'admin':
      return all;
    case 'editor':
      // read + non-bulk write (no *_bulk, no write:domains). `write:search` is
      // excluded too: the REST route it mirrors (POST /v1/search/reindex) requires
      // the admin role, and a tenant-wide index rebuild is an operations action,
      // not an editing one.
      return all.filter(
        (s) => !s.endsWith('_bulk') && s !== 'write:domains' && s !== 'write:search'
      );
    case 'viewer':
      return all.filter((s) => s.startsWith('read:'));
    case 'api':
    default:
      return [];
  }
}

/** Intersect a requested/selected scope list with what the role may grant,
 *  drop unknowns, dedupe. Returns ONLY business scopes (OIDC framing is added
 *  separately at authorize time). */
export function capBusinessScopes(requested: string[], role: StaffRole): McpBusinessScope[] {
  const allowed = new Set<string>(grantableScopesForRole(role));
  const seen = new Set<string>();
  const out: McpBusinessScope[] = [];
  for (const s of requested) {
    if (allowed.has(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s as McpBusinessScope);
    }
  }
  return out;
}
