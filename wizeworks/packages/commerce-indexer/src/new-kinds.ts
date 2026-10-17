// A kind new to search reaches the records that already exist (sparx persona
// issue 261).
//
// A projector indexes a record when it is written. Records written BEFORE the
// projector shipped never are: 261 made 33 more kinds findable, and on the next
// release every board, report and shelf a business already had would still
// answer "Nothing in your records matches", with no "Put them back" offered,
// because the search box only counts products, customers and orders. The same
// holds for rows a seed or a migration wrote around the services.
//
// So on every indexer boot, per tenant: ask search which kinds it holds, and for
// each registered kind it holds none of, look for rows. Rows with no entries are
// indexed. A kind with entries is left alone; its write signals keep it current,
// and the full rebuild is still the remedy for drift inside a kind.

import { prisma } from '@wizeworks/db';
import { indexedKindsForTenant } from '@wizeworks/search';
import type { Logger } from 'pino';

import { REGISTRY } from './registry.js';
import { indexKind } from './reindex.js';

export interface NewKindsSummary {
  tenants: number;
  /** One entry per tenant and kind that was filled in. */
  filled: { tenantId: string; entityType: string; indexed: number; errors: number }[];
  /** Tenants stepped over because a step threw. Non-zero means read the warns. */
  skipped: number;
}

/**
 * Fill in every kind a tenant has rows of and no search entries for.
 *
 * ONE TENANT CANNOT SINK THE PASS: each tenant is sealed off, as in
 * `reconcileSystemSeeds`, so a tenant deleted mid-pass or one bad projector
 * costs that tenant only. Idempotent: a second run finds the kinds present.
 */
export async function fillNewKinds(logger: Logger): Promise<NewKindsSummary> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const summary: NewKindsSummary = { tenants: tenants.length, filled: [], skipped: 0 };
  for (const { id: tenantId } of tenants) {
    try {
      summary.filled.push(...(await fillTenant(tenantId, logger)));
    } catch (err) {
      summary.skipped += 1;
      logger.warn({ tenantId, err }, 'new kinds: skipped a tenant whose pass failed');
    }
  }
  return summary;
}

async function fillTenant(tenantId: string, logger: Logger): Promise<NewKindsSummary['filled']> {
  const ctx = { tenantId };
  const present = await indexedKindsForTenant(tenantId);
  const filled: NewKindsSummary['filled'] = [];
  for (const projector of REGISTRY.values()) {
    if (present.has(projector.entityType)) continue;
    const ids = await projector.listIdsForTenant(ctx);
    if (ids.length === 0) continue;
    const out = await indexKind(ctx, projector, ids, true, logger);
    filled.push({ tenantId, entityType: projector.entityType, ...out });
  }
  return filled;
}
