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

export type ModuleSlug =
  | 'builder'
  | 'commerce'
  | 'cms'
  | 'crm'
  | 'email'
  | 'b2b'
  | 'dropship'
  | 'inventory'
  | 'chat'
  | 'ai';

// Canonical ordering is irrelevant here — callers (sidebar, breadcrumb) order
// by their own manifest list. This is just the closed set we probe.
const ALL_MODULES: readonly ModuleSlug[] = [
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'dropship',
  'inventory',
  'chat',
  'ai',
];

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
  // enables modules explicitly via the seed.
  const enabled = readModuleFlag(tenant?.settings, module);

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
  return ALL_MODULES.filter((m) => readModuleFlag(tenant?.settings, m));
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
