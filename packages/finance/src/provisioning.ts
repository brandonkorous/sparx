// What happens when a tenant turns Finance on.
//
// Exactly one thing: the seeded category set. Everything else in the module is
// the tenant's own data, and a module that invents rows nobody asked for is how
// a fresh screen ends up looking used.
//
// Idempotent, because a tenant can turn the module off and back on (and because
// `module.activated` is a Pub/Sub event, which means it can arrive twice).

import { type TxClient } from '@sparx/db';

import { seedCategories } from './categories';

export interface FinanceProvisionResult {
  categoriesSeeded: number;
}

/**
 * Provision Finance for a tenant. Called by the module-activation path, never by
 * a preset — a preset provisions config into an ALREADY-enabled module and never
 * writes `settings.modules` (the ModulePreset contract in @sparx/modules).
 */
export async function provisionFinance(
  tenantId: string,
  tx?: TxClient
): Promise<FinanceProvisionResult> {
  const categories = await seedCategories(tenantId, tx);
  return { categoriesSeeded: categories.length };
}
