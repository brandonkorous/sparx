// Module-enablement primitives — the "disabled module = zero overhead" rule
// (locked decision #6). Extracted from @sparx/auth so it carries NO auth/email/UI
// closure: it only reads `tenants.settings.modules.<slug>.enabled`.
//
// The session-coupled `requireModule(session, …)` stays in @sparx/auth (it needs
// SparxSession); it composes the session-free `isModuleEnabled` exported here.
//
// Storage: per-tenant flags live in `tenants.settings.modules.<slug>.enabled`.
// The `tenants` table is RLS-exempt by design (the dispatch table — every request
// reads it before tenant context is set), so this helper uses the raw prisma
// client directly rather than wrapping in withTenant.
//
// Caching: a small in-process map keyed by `${tenantId}:${module}` with a 60s TTL
// avoids hammering the DB for the same flag on every request. Invalidation happens
// via the module.activated / module.deactivated event consumer.

import { prisma } from '@sparx/db';

// The module-preset contract + pure registry index (the reusable install seam).
// Type-only dep on ModuleSlug below, so no runtime cycle.
export * from './presets';
// Industry starters — the second provisioning tier that composes presets across
// modules (definitions + install seam live at the api-rest composition root).
export * from './starters';

export type ModuleSlug =
  | 'builder'
  | 'commerce'
  | 'cms'
  | 'crm'
  | 'email'
  | 'b2b'
  | 'invoicing'
  | 'dropship'
  | 'inventory'
  | 'chat'
  | 'ai'
  | 'scheduling'
  // Social posting (docs/133) — connect the tenant's own social accounts and
  // publish native posts to them. Cross-cutting + FREE (no MODULE_MONTHLY_CENTS
  // entry): a CMS-only publisher, a CRM-only outreach team, and a full storefront
  // all want it, so it is gated on its own flag rather than folded into commerce
  // the way channels is. No REQUIRES/BUNDLED_FREE — it runs standalone.
  | 'social'
  // Spend tracking + profitability (docs/148). Records what the business PAID and
  // nets it against what the existing surfaces already know came in. Stands
  // completely alone — unlike invoicing (needs someone to invoice) or inventory
  // (needs products), a solo consultant with no other module is a valid
  // finance-only tenant, which is why it carries a standalone price. But it is
  // BUNDLED_FREE with commerce/b2b: a business already selling through sparx has
  // the money-in half of its P&L here, and charging a second time to see the
  // money-out half prices out exactly the small businesses this is for.
  //
  // NOTE the half that is NOT gated on this. The money-IN surfaces (Payments,
  // Payouts, Owed to you, Where money comes from, Your sparx bill) are a view of
  // data the tenant already paid for through commerce/invoicing/b2b, so they carry
  // their own `requiresModules` in the workbench catalog and stay reachable
  // without this flag. Only the spend + profitability half is billable.
  | 'finance'
  // The people who do the work (docs/149) — who they are, what they cost, when
  // they work, what they are qualified to do. It exists next to finance because
  // wages are the largest single expense in most service businesses, so job
  // profitability is arithmetically impossible without it: staff is the SOURCE of
  // the biggest number in the ledger, not an adjacent HR ambition.
  //
  // Priced standalone at $29 and deliberately NOT bundled with finance in either
  // direction. They are independently valuable — a business that only wants a rota
  // and certification-expiry alerts is a valid staff-only tenant — and the
  // sequencing story ("finance now, staff makes it sharper") is a far easier second
  // sale than one large module that has to be right all at once. Also NOT per-seat:
  // every other module is a flat monthly price, and inventing a headcount billing
  // dimension for one of them complicates reconciliation, the pricing page and the
  // `activeTotalCents` math for no real gain.
  //
  // NOT payroll, permanently. sparx records hours and rates and hands them to
  // whoever runs payroll. It never withholds, never files, never pays anyone.
  | 'staff';

/**
 * THE closed set of module slugs — the one list, exported so nothing re-declares
 * it.
 *
 * It used to be private, and every consumer that needed the vocabulary kept its
 * own copy. That is not a tidiness complaint: api-rest's copy has twice fallen
 * behind this one (`inventory` and `finance` were both added here and forgotten
 * there), and the symptom is that the module typechecks everywhere and then
 * cannot be turned on at all, because the activation toggle refuses the slug as
 * "Request validation failed".
 *
 * Ordering is stable but carries no meaning — callers that display modules order
 * them by their own manifest.
 */
export const ALL_MODULES: readonly ModuleSlug[] = [
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'invoicing',
  'dropship',
  'inventory',
  'chat',
  'ai',
  'scheduling',
  'social',
  'finance',
  'staff',
];

// ── Module dependency graph ──────────────────────────────────────────────────
//
// Two relationships, and they BILL DIFFERENTLY, so they are deliberately NOT the
// same map. Conflating them would either give a paid module away free or charge
// for a bundled one.
//
// BUNDLED_FREE — the key is a capability PROVIDED FREE by any listed module. It is
//   active (and never separately billed) whenever a provider is active, even if
//   its own flag was never written. `invoicing` rides along free with `b2b` /
//   `commerce`: B2B/Commerce tenants get the full invoicing surface at $0, while a
//   tenant with neither pays for the standalone `invoicing` module. Because the
//   bundled case never sets the `invoicing` flag, a billing reconciliation that
//   maps set flags → subscription items never charges for it. Resolved at READ
//   time here (pure derivation — nothing is written).
//
// REQUIRES — the key cannot run without the listed modules, and those modules are
//   SEPARATELY BILLED (B2B needs Commerce at $49 — wholesale on the same catalog).
//   Builder is deliberately NOT required by Commerce/CMS/Email: those are API-first
//   and run fully HEADLESS — drive the commerce API from your own storefront, pull
//   CMS content over the API/MCP, send email with no hosted page. Builder is the
//   OPTIONAL hosted-site module (it renders + hosts pages, themes, domains) you add
//   when you want sparx to serve the site — an independent opt-in, never a base the
//   others depend on. This is NOT derived at read time: enabling the dependent must
//   physically WRITE + bill the requirement, and disabling a requirement while its
//   dependent is active is blocked. Enforced WRITE-side by the module-toggle
//   handlers via the helpers below — deriving it here would grant unbilled access.
//   Requirements compose transitively (`requiredModules('b2b')` pulls in Commerce).
export const BUNDLED_FREE: Partial<Record<ModuleSlug, readonly ModuleSlug[]>> = {
  invoicing: ['b2b', 'commerce'],
  // Stock tracking rides along free with selling modules: any Commerce or B2B
  // tenant gets the full inventory surface at $0 (mirrors invoicing↔b2b/commerce).
  // A WMS-only tenant with neither pays the $29 standalone `inventory` price.
  inventory: ['commerce', 'b2b'],
  // Spend + profitability rides along with the selling modules for the same
  // reason, and one more specific to it: profit is revenue MINUS spend, and a
  // Commerce/B2B tenant already bought the revenue half. Selling them the
  // subtrahend separately is charging twice for one number. A tenant with
  // neither — a consultancy, a nonprofit, a landlord tracking spend against
  // invoices — pays the $29 standalone `finance` price.
  finance: ['commerce', 'b2b'],
};

export const REQUIRES: Partial<Record<ModuleSlug, readonly ModuleSlug[]>> = {
  b2b: ['commerce'],
};

/** The transitive set of modules that must be enabled (and billed) for `module`
 *  to run. The toggle handler turns these on when `module` is enabled. */
export function requiredModules(module: ModuleSlug): ModuleSlug[] {
  const out = new Set<ModuleSlug>();
  const visit = (m: ModuleSlug): void => {
    for (const dep of REQUIRES[m] ?? []) {
      if (!out.has(dep)) {
        out.add(dep);
        visit(dep);
      }
    }
  };
  visit(module);
  return [...out];
}

/** Enabled modules that REQUIRE `module` — disabling `module` while any of these
 *  is still on must be blocked. `isOn` probes the prospective flag state. */
export function blockingDependents(
  module: ModuleSlug,
  isOn: (m: ModuleSlug) => boolean
): ModuleSlug[] {
  const blockers: ModuleSlug[] = [];
  for (const dependent of Object.keys(REQUIRES) as ModuleSlug[]) {
    if ((REQUIRES[dependent] ?? []).includes(module) && isOn(dependent)) {
      blockers.push(dependent);
    }
  }
  return blockers;
}

/** Whether `module` is on for these settings, honoring the BUNDLED_FREE graph:
 *  on when its own flag is set OR any module that provides it free is set.
 *  REQUIRES is intentionally NOT derived here (see the graph note). */
export function isModuleFlagOn(settings: unknown, module: ModuleSlug): boolean {
  if (readModuleFlag(settings, module)) return true;
  for (const provider of BUNDLED_FREE[module] ?? []) {
    if (readModuleFlag(settings, provider)) return true;
  }
  return false;
}

/** Source of a module's enabled state, for UIs that must distinguish a real
 *  purchase from a bundled / required one (to lock the toggle + label it). */
export type ModuleEnabledSource = 'explicit' | 'bundled' | 'off';

/** Derive every module's enabled state + WHY, in one settings read. `bundled`
 *  means on because a BUNDLED_FREE provider is active (the toggle should be shown
 *  as "Included" and locked).
 *
 *  Bundling takes PRECEDENCE over a standalone purchase: if a provider that
 *  bundles a capability free is active, the capability is `bundled` even when the
 *  tenant's own flag is also set — so a tenant who bought `invoicing` standalone
 *  and later turned on Commerce/B2B stops being charged for it (source flips
 *  explicit → bundled, which drops it from the billable set). The standalone flag
 *  is preserved, not cleared, so removing the provider re-surfaces it as
 *  `explicit` and billing resumes. */
export function deriveModuleStates(
  settings: unknown
): Record<ModuleSlug, { enabled: boolean; source: ModuleEnabledSource; includedBy: ModuleSlug[] }> {
  const out = {} as Record<
    ModuleSlug,
    { enabled: boolean; source: ModuleEnabledSource; includedBy: ModuleSlug[] }
  >;
  for (const m of ALL_MODULES) {
    const includedBy = (BUNDLED_FREE[m] ?? []).filter((p) => readModuleFlag(settings, p));
    if (includedBy.length) {
      out[m] = { enabled: true, source: 'bundled', includedBy };
      continue;
    }
    out[m] = readModuleFlag(settings, m)
      ? { enabled: true, source: 'explicit', includedBy: [] }
      : { enabled: false, source: 'off', includedBy: [] };
  }
  return out;
}

export class ModuleDisabledError extends Error {
  readonly code = 'MODULE_DISABLED' as const;
  readonly module: ModuleSlug;
  readonly tenantId: string;
  constructor(module: ModuleSlug, tenantId: string) {
    super(`Module "${module}" is not active for this tenant`);
    this.module = module;
    this.tenantId = tenantId;
    // Preserve correct prototype for `instanceof` checks across module
    // boundaries in tsx / Next bundling.
    Object.setPrototypeOf(this, ModuleDisabledError.prototype);
  }
}

interface CacheEntry {
  enabled: boolean;
  expiresAt: number;
}
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(tenantId: string, module: ModuleSlug): string {
  return `${tenantId}:${module}`;
}

/** Drop any cached state for a tenant — called by the module.activated /
 *  module.deactivated event consumer. Exported so tests can call it directly
 *  without waiting for the TTL. */
export function invalidateModuleCache(tenantId?: string, module?: ModuleSlug): void {
  if (tenantId && module) {
    cache.delete(cacheKey(tenantId, module));
    return;
  }
  if (tenantId) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) cache.delete(key);
    }
    return;
  }
  cache.clear();
}

/** Check whether a module is enabled for a tenant. Reads tenant.settings
 *  with a per-process map + 60s TTL. */
export async function isModuleEnabled(tenantId: string, module: ModuleSlug): Promise<boolean> {
  const key = cacheKey(tenantId, module);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.enabled;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  // Default-deny: an unset flag means the module is not active. This mirrors the
  // production billing model — modules opt in via Stripe subscription. Dev/test
  // enables modules explicitly via the seed. `isModuleFlagOn` also honors the
  // BUNDLED_FREE graph (e.g. `invoicing` is on for any B2B/Commerce tenant), so
  // the existing per-module gates "just pass" for bundled capabilities.
  const enabled = isModuleFlagOn(tenant?.settings, module);

  cache.set(key, { enabled, expiresAt: Date.now() + TTL_MS });
  return enabled;
}

/** List every module enabled for a tenant in a single `tenants` read. The shell
 *  uses this to filter the sidebar + breadcrumb module switcher so a tenant never
 *  sees modules it hasn't activated. Same default-deny semantics as
 *  `isModuleEnabled`. Not cached — one row read per dashboard render. */
export async function listEnabledModules(tenantId: string): Promise<ModuleSlug[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  // Includes BUNDLED_FREE capabilities (invoicing rides along with B2B/Commerce)
  // so the sidebar / breadcrumb switcher surface them for those tenants.
  return ALL_MODULES.filter((m) => isModuleFlagOn(tenant?.settings, m));
}

function readModuleFlag(settings: unknown, module: ModuleSlug): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const modules = (settings as Record<string, unknown>).modules;
  if (!modules || typeof modules !== 'object') return false;
  const slot = (modules as Record<string, unknown>)[module];
  if (!slot || typeof slot !== 'object') return false;
  return (slot as Record<string, unknown>).enabled === true;
}

/** Same shape as the platform error envelope from docs/06 §4 — REST and Server
 *  Actions both render this shape so the dashboard / SDK / MCP client see a single
 *  error format regardless of transport. */
export function moduleDisabledEnvelope(err: ModuleDisabledError): {
  success: false;
  error: {
    code: 'MODULE_DISABLED';
    message: string;
    module: ModuleSlug;
  };
} {
  return {
    success: false,
    error: {
      code: 'MODULE_DISABLED',
      message: err.message,
      module: err.module,
    },
  };
}
