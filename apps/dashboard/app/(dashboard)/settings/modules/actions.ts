'use server';

// Server actions for the modules settings page.
//
// Every toggle and read goes through api-rest now (`PATCH /v1/tenant/modules/:slug`,
// `GET /v1/tenant/modules`). The role gate (owner/admin only), persistence,
// and the in-process module-gate cache invalidation all live there.
//
// Activation seeding is no longer the dashboard's job (docs/82 Slice E4): the
// toggle route publishes `module.activated` on both event buses, so the CRM
// pipeline/segments and email default automations seed themselves synchronously
// inside that request, and the automation-worker seeds system automations off
// the fan-in. We used to follow the toggle with a separate `POST /v1/crm/bootstrap`
// — that's now redundant and has been removed.
//
// Cross-process cache (api-rest's separate LRU) self-heals within 60s via the TTL.

import 'server-only';
import { revalidatePath } from 'next/cache';
import { type ModuleSlug } from '@sparx/auth';

import { api, type ApiRestError } from '@/lib/api-rest-client';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

const VALID_SLUGS: ReadonlySet<ModuleSlug> = new Set([
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
]);

export async function setModuleEnabledAction(
  slug: ModuleSlug,
  enabled: boolean
): Promise<ActionResult<{ slug: ModuleSlug; enabled: boolean }>> {
  if (!VALID_SLUGS.has(slug)) {
    return { ok: false, error: { message: `Unknown module: ${slug}` } };
  }
  try {
    const result = await api.patch<{ slug: ModuleSlug; enabled: boolean }>(
      `/v1/tenant/modules/${encodeURIComponent(slug)}`,
      { enabled }
    );

    // Activation seeding (CRM pipeline/segments, email automations, system
    // automations) is handled by the toggle route's `module.activated` publish —
    // see the file header. No follow-up bootstrap call needed.

    revalidatePath('/settings/modules');
    revalidatePath(`/${slug}`, 'layout');
    return { ok: true, data: result };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: { message: e.message ?? 'Module update failed.' } };
  }
}

export interface ModuleState {
  slug: ModuleSlug;
  enabled: boolean;
  // Why it's on: 'explicit' = purchased/toggled; 'bundled' = derived free from a
  // provider module (invoicing rides along with B2B/Commerce); 'off'.
  source: 'explicit' | 'bundled' | 'off';
  // Providers that bundle this capability free (set when source === 'bundled').
  includedBy: ModuleSlug[];
  // Enabled modules that REQUIRE this one — non-empty means the toggle is locked
  // on (you must disable the dependent first, e.g. Commerce while B2B is on).
  requiredBy: ModuleSlug[];
}

export async function listModuleStateForCurrentTenant(): Promise<ModuleState[]> {
  return api.get<ModuleState[]>('/v1/tenant/modules');
}
