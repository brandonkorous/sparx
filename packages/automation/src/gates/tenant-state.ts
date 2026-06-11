// Cached tenant state for the global gate chain.
//
// The global gates (tenant-active, kill-switch, module-active) all read the same
// `tenants` row. Reading it once per action-dispatch ×3 gates would hammer the
// table, so we cache `{ status, settings }` per tenant with a short TTL — exactly
// the shape `@sparx/auth`'s module-gate uses. The `tenants` table is RLS-exempt
// (it's the dispatch table), so the tenant tx reads it regardless of the GUC.

import type { TenantCtx } from '../engine-types';

interface TenantState {
  status: string;
  settings: unknown;
}

interface CacheEntry {
  state: TenantState;
  expiresAt: number;
}

const TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

export async function loadTenantState(ctx: TenantCtx): Promise<TenantState> {
  const hit = cache.get(ctx.tenantId);
  if (hit && hit.expiresAt > Date.now()) return hit.state;

  const row = await ctx.tx.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { status: true, settings: true },
  });
  const state: TenantState = { status: row?.status ?? 'unknown', settings: row?.settings ?? null };
  cache.set(ctx.tenantId, { state, expiresAt: Date.now() + TTL_MS });
  return state;
}

/** Read `settings.modules.<slug>.enabled` (default-deny), matching module-gate. */
export function moduleEnabledInSettings(settings: unknown, module: string): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const modules = (settings as Record<string, unknown>).modules;
  if (!modules || typeof modules !== 'object') return false;
  const slot = (modules as Record<string, unknown>)[module];
  if (!slot || typeof slot !== 'object') return false;
  return (slot as Record<string, unknown>).enabled === true;
}

/** Read `settings.automations.disabled` — the per-tenant automation kill switch. */
export function automationsDisabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const auto = (settings as Record<string, unknown>).automations;
  if (!auto || typeof auto !== 'object') return false;
  return (auto as Record<string, unknown>).disabled === true;
}

/** Test hook — clear the per-process tenant-state cache between suites. */
export function _resetTenantStateCache(): void {
  cache.clear();
}
