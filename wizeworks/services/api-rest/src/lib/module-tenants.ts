// Which tenants a scheduled job should run for.
//
// ── WHY THIS EXISTS RATHER THAN THE JSON-FLAG QUERY ──────────────────────────
// The established scheduler pattern enumerates by the raw settings flag:
//
//   settings: { path: ['modules', 'crm', 'enabled'], equals: true }
//
// That is correct for `crm` and `invoicing`, and WRONG for any module that is
// `BUNDLED_FREE`. A bundled capability's flag is never written — turning on
// Commerce makes `finance`, `inventory` and `invoicing` available with no flag
// of their own — so the JSON query returns the small set of tenants who bought
// it standalone and silently skips everyone who has it bundled. On the dev
// database that is 49 tenants out of 49: the backfill that found them found
// EVERY ONE of them bundled via Commerce or B2B.
//
// A scheduled job that skips those tenants does not fail. It reports success
// over an empty list, which is the failure mode this codebase keeps paying for.
// So availability is DERIVED here, the same way the module gate derives it at
// request time, rather than read off a flag that is only half the truth.
//
// The `tenants` table is RLS-exempt by design (it is the dispatch table), so
// this reads with the default client. Anything the caller then does with a
// tenant id must go through `withTenant` — see the header of
// `scripts/backfill-finance-categories.ts` for what happens when it does not.

import { prisma } from '@wizeworks/db';
import { deriveModuleStates, type ModuleSlug } from '@wizeworks/modules';

export interface ModuleTenant {
  id: string;
  slug: string;
  /** How the tenant came to have the module — `'bundled'` or a direct purchase.
   *  Carried so a job's log can say WHY it processed someone. */
  source: string;
  /** For a bundled capability, the modules that provide it. Empty otherwise. */
  includedBy: string[];
}

/**
 * Every active tenant for which `module` is AVAILABLE — bought outright or
 * bundled in by something else.
 *
 * Deliberately not paginated. `tenants` is the dispatch table, it is small by
 * construction (one row per customer, not per record), and a scheduler that
 * processed a page of it would be a scheduler that silently skipped the rest.
 */
export async function listTenantsWithModule(module: ModuleSlug): Promise<ModuleTenant[]> {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'active' },
    select: { id: true, slug: true, settings: true },
    orderBy: { createdAt: 'asc' },
  });

  const out: ModuleTenant[] = [];
  for (const tenant of tenants) {
    const state = deriveModuleStates(tenant.settings)[module];
    if (!state?.enabled) continue;
    out.push({
      id: tenant.id,
      slug: tenant.slug,
      source: state.source,
      includedBy: [...state.includedBy],
    });
  }
  return out;
}
