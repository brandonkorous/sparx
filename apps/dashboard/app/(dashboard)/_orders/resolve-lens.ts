import { api } from '@/lib/api-rest-client';

import { COMMERCE_ORDER_LENS, ORDER_LENS_PRECEDENCE, type OrderLens } from './lens';

// Which order lens to use when the surface has no route to infer it from.
//
// The three order ROUTES each pass their lens explicitly — they know who they
// are. The drawer/modal detail chrome (_shell/detail-slot.tsx) does not: it is
// one parallel-route slot serving every entity type, so it has to ask which of
// Commerce / B2B / CRM this tenant actually pays for and pick the matching view.
//
// Getting this wrong is not cosmetic: defaulting to the commerce lens would show
// a CRM-only tenant fulfillment and shipping-label chrome they have no
// entitlement to, and whose API calls would be refused.

interface ModuleState {
  slug: string;
  enabled: boolean;
}

/** The lens this tenant should see, by module precedence (Commerce > B2B > CRM).
 *  Falls back to the commerce lens if the module lookup fails — the shared order
 *  gate would already have refused a tenant with none of the three, so anything
 *  reaching here holds at least one. */
export async function resolveTenantOrderLens(): Promise<OrderLens> {
  const state = await api.get<ModuleState[]>('/v1/tenant/modules').catch(() => [] as ModuleState[]);
  const enabled = new Set(state.filter((m) => m.enabled).map((m) => m.slug));
  return ORDER_LENS_PRECEDENCE.find((lens) => enabled.has(lens.module)) ?? COMMERCE_ORDER_LENS;
}
