// Segment evaluation helpers — preview-count + full recompute.
//
// Both are read-then-evaluate paths over @wizeworks/crm-schemas'
// evaluateSegmentRule. previewCount samples customers for sub-second editor
// feedback; recomputeFull walks every customer (nightly safety-net to
// reconcile drift from dropped events).

import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';
import { SegmentRuleSchema, evaluateSegmentRule, type SegmentRule } from '@wizeworks/crm-schemas';

import { buildSegmentRuleProjection } from '../consumers/segment-projection';
import type { ServiceContext } from '../errors';
import { CrmValidationError } from '../errors';

const PREVIEW_SAMPLE_DEFAULT = 250;

/** Evaluate a candidate rule (not necessarily persisted yet) against a
 *  sample of customers and return the match count + sampled total. The
 *  dashboard rule editor calls this on every change to show "X of Y match." */
export async function previewCount(
  ctx: ServiceContext,
  args: { rule: unknown; sampleSize?: number; propertyId?: string | null }
): Promise<{ matches: number; sampled: number; total: number }> {
  const parsed = SegmentRuleSchema.safeParse(args.rule);
  if (!parsed.success) {
    throw new CrmValidationError('Rule failed validation', [
      { field: 'rule', message: parsed.error.issues[0]?.message ?? 'Invalid rule' },
    ]);
  }
  const rule: SegmentRule = parsed.data;
  const limit = Math.min(args.sampleSize ?? PREVIEW_SAMPLE_DEFAULT, 1000);

  // THE PREVIEW HAS TO COUNT THE SAME PEOPLE THE SEGMENT CAN CONTAIN.
  //
  // A segment draws from ONE site plus the tenant-wide contacts (docs/131 §5),
  // and the evaluator enforces that when it materialises membership. The preview
  // did not: it scanned every customer in the tenant, so a rule builder said
  // "24 of 24 match", the owner saved, and the segment came back with 22 — the
  // other two belonging to a different business under the same tenant, unable to
  // join and never explained. Worse than the mismatch, the count was quietly
  // describing another business's customers.
  const scope: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...(args.propertyId ? { OR: [{ propertyId: args.propertyId }, { propertyId: null }] } : {}),
  };

  return withTenant(ctx, async (tx) => {
    const [sample, total] = await Promise.all([
      tx.customer.findMany({
        where: scope,
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      tx.customer.count({ where: scope }),
    ]);

    let matches = 0;
    for (const c of sample) {
      // Compose into the already-open transaction — a bare `ctx` here would
      // make buildSegmentRuleProjection's own withTenant open a SECOND,
      // nested $transaction (Prisma forbids nesting), which silently failed
      // and made every preview report 0 matches regardless of the rule.
      const projection = await buildSegmentRuleProjection({ ...ctx, tx }, c.id).catch(() => null);
      if (!projection) continue;
      if (evaluateSegmentRule(rule, projection)) matches += 1;
    }

    return { matches, sampled: sample.length, total };
  });
}

/** Full recompute — re-evaluate every customer against every active
 *  segment for the tenant, reconciling segment_members. Nightly batch path;
 *  expensive (O(customers × segments × projection-fetch)). Use sparingly. */
export async function recomputeFull(
  ctx: ServiceContext,
  args: { segmentId?: string } = {}
): Promise<{ scanned: number; changed: number }> {
  let scanned = 0;
  let changed = 0;

  const customerIds = await withTenant(ctx, (tx) =>
    tx.customer.findMany({
      where: { deletedAt: null },
      select: { id: true },
    })
  );

  // Process one customer at a time. evaluateCustomerForTenant lives in the
  // consumer module — we import lazily to avoid a service ↔ consumer cycle.
  const { evaluateCustomerForTenant } = await import('../consumers/segment-evaluator');

  for (const { id } of customerIds) {
    const { entered, exited } = await evaluateCustomerForTenant(ctx.tenantId, id);
    scanned += 1;
    if (args.segmentId) {
      if (entered.includes(args.segmentId) || exited.includes(args.segmentId)) changed += 1;
    } else if (entered.length > 0 || exited.length > 0) {
      changed += 1;
    }
  }

  return { scanned, changed };
}
