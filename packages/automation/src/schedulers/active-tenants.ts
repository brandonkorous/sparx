// Iterate tenants worth reconciling the automation run-activity rollup for.
//
// Automations are a PLATFORM CAPABILITY, not a gated module (docs/81 §3) — there
// is no `automations` module flag to filter on. So instead of a module gate this
// enumerates active tenants that own at least one automation: a tenant with zero
// automations has no runs and would reconcile an empty window every night for
// nothing. `automations: { some: {} }` keeps the nightly job's tenant set tight.

import { prisma } from '@sparx/db';

/** Active tenants that own ≥1 automation — the set the run-activity rollup
 *  reconcile iterates. Suspended/cancelled tenants get no cycles. */
export async function listAutomationActiveTenants(): Promise<{ id: string }[]> {
  return prisma.tenant.findMany({
    where: {
      status: 'active',
      automations: { some: {} },
    },
    select: { id: true },
  });
}
