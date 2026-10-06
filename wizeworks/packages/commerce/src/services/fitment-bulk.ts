// Adding what many products fit, or taking it off, in one write.
//
// `bulkAssign` REPLACES each product's rules: it was written for importers that
// own a product's whole fitment. That is the wrong shape for an owner adding the
// L5P Duramax to 34 injectors, most of which already fit two other engines: a
// replace would quietly take those two away. So these ADD and REMOVE.
//
// Adding skips a rule a product already has. "The same rule" is the same list,
// the same entry, and the same windows (years, weight): the L5P for 2017-2019
// and the L5P for 2020-2023 are two rules and both are kept, because a shopper
// filtering by 2021 needs the second one. A note is not part of a rule's
// identity; it is the owner's memo about it.

import { randomUUID } from 'node:crypto';

import {
  BulkAddFitmentInput,
  BulkRemoveFitmentInput,
  type FitmentDimension,
  type ProductFitmentInput,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, TxClient } from '@wizeworks/db';

import { writeAuditLogs } from '../audit';
import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';
import { resolveSelection } from './product-selection';

type NewRule = Omit<ProductFitmentInput, 'productId'>;

/** A rule as far as "is this the same rule" is concerned. */
export interface RuleShape {
  domainId: string;
  nodeId?: string | null;
  ranges: readonly {
    dimensionKey: string;
    min?: number | null | Prisma.Decimal;
    max?: number | null | Prisma.Decimal;
  }[];
}

const BULK_TIMEOUT_MS = 60_000;

function bound(value: number | null | undefined | Prisma.Decimal): string {
  return value === null || value === undefined ? '' : String(Number(value));
}

/** Two rules with the same key say the same thing. Windows are compared in
 *  axis order, so the order they were typed in does not make a new rule. */
export function ruleKey(rule: RuleShape): string {
  const ranges = [...rule.ranges]
    .sort((a, b) => a.dimensionKey.localeCompare(b.dimensionKey))
    .map((range) => `${range.dimensionKey}=${bound(range.min)}..${bound(range.max)}`)
    .join(',');
  return `${rule.domainId}|${rule.nodeId ?? '*'}|${ranges}`;
}

/**
 * The (product, rule) pairs to write: every chosen product gets every rule it
 * does not already have. Duplicates within `rules` collapse to one.
 */
export function planFitmentAdds(
  existing: readonly (RuleShape & { productId: string })[],
  productIds: readonly string[],
  rules: readonly NewRule[]
): { productId: string; rule: NewRule }[] {
  const have = new Set(existing.map((row) => `${row.productId}#${ruleKey(row)}`));
  const unique = new Map<string, NewRule>();
  for (const rule of rules) {
    const key = ruleKey(rule);
    if (!unique.has(key)) unique.set(key, rule);
  }

  const out: { productId: string; rule: NewRule }[] = [];
  for (const productId of new Set(productIds)) {
    for (const [key, rule] of unique) {
      if (have.has(`${productId}#${key}`)) continue;
      out.push({ productId, rule });
    }
  }
  return out;
}

/** Refuse entries that are not in this list, and windows on an axis this list
 *  does not have, with the sentence an owner can act on. */
async function requireDomainShape(
  tx: TxClient,
  domainId: string,
  nodeIds: readonly (string | null | undefined)[],
  rangeKeys: readonly string[]
): Promise<void> {
  const domain = await tx.fitmentDomain.findFirst({
    where: { id: domainId, deletedAt: null },
    select: { dimensions: true, displayName: true },
  });
  if (!domain) throw new CommerceNotFoundError('FitmentDomain', domainId);

  const wanted = [...new Set(nodeIds.filter((id): id is string => Boolean(id)))];
  if (wanted.length > 0) {
    const found = await tx.fitmentNode.count({
      where: { id: { in: wanted }, domainId, deletedAt: null },
    });
    if (found !== wanted.length) {
      throw new CommerceValidationError(
        `Some of those entries are no longer in “${domain.displayName}”. Open the list again and choose them afresh.`
      );
    }
  }

  const dimensions = Array.isArray(domain.dimensions)
    ? (domain.dimensions as unknown as FitmentDimension[])
    : [];
  const rangeAxes = new Set(dimensions.filter((d) => d.kind === 'range').map((d) => d.key));
  const unknown = rangeKeys.filter((key) => !rangeAxes.has(key));
  if (unknown.length > 0) {
    throw new CommerceValidationError(
      `“${domain.displayName}” has no ${unknown.join(', ')} to narrow by.`
    );
  }
}

function auditRows(ctx: ServiceContext, action: string, counts: Map<string, number>) {
  return [...counts].map(([productId, rules]) => ({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? ('user' as const) : ('system' as const),
    action,
    entityType: 'Product',
    entityId: productId,
    diff: { after: { rules } },
  }));
}

async function announce(ctx: ServiceContext, productIds: Iterable<string>): Promise<void> {
  await Promise.all(
    [...productIds].map((productId) =>
      publishCommerceEvent({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        topic: 'product.updated',
        data: { productId, change: 'fitment' },
      })
    )
  );
}

export interface FitmentBulkResult {
  /** Rules written (add) or taken off (remove). */
  rules: number;
  /** Products that gained (add) or lost (remove) at least one rule. */
  productsChanged: number;
  /** Chosen products this changed nothing on: they already had every rule, or
   *  (remove) had none of them. */
  productsUnchanged: number;
  /** Ids that no longer name a live product. */
  skipped: number;
}

/** Add rules to every product a selection names. Never deletes a rule. */
export async function addToProducts(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<FitmentBulkResult> {
  const input = BulkAddFitmentInput.parse(rawInput);

  const result = await withTenant(
    ctx,
    async (tx) => {
      for (const domainId of new Set(input.fitments.map((f) => f.domainId))) {
        const rules = input.fitments.filter((f) => f.domainId === domainId);
        await requireDomainShape(
          tx,
          domainId,
          rules.map((f) => f.nodeId),
          rules.flatMap((f) => f.ranges.map((r) => r.dimensionKey))
        );
      }
      const { ids, requested } = await resolveSelection(tx, input.selection);
      const existing = await tx.productFitment.findMany({
        where: {
          productId: { in: ids },
          domainId: { in: [...new Set(input.fitments.map((f) => f.domainId))] },
        },
        select: {
          productId: true,
          domainId: true,
          nodeId: true,
          ranges: { select: { dimensionKey: true, min: true, max: true } },
        },
      });
      const plan = planFitmentAdds(existing, ids, input.fitments);

      const fitmentRows: Prisma.ProductFitmentCreateManyInput[] = [];
      const rangeRows: Prisma.ProductFitmentRangeCreateManyInput[] = [];
      const perProduct = new Map<string, number>();
      for (const { productId, rule } of plan) {
        const id = randomUUID();
        fitmentRows.push({
          id,
          tenantId: ctx.tenantId,
          productId,
          domainId: rule.domainId,
          nodeId: rule.nodeId ?? null,
          notes: rule.notes ?? null,
        });
        for (const range of rule.ranges) {
          rangeRows.push({
            tenantId: ctx.tenantId,
            fitmentId: id,
            dimensionKey: range.dimensionKey,
            min: range.min ?? null,
            max: range.max ?? null,
          });
        }
        perProduct.set(productId, (perProduct.get(productId) ?? 0) + 1);
      }
      if (fitmentRows.length > 0) await tx.productFitment.createMany({ data: fitmentRows });
      if (rangeRows.length > 0) await tx.productFitmentRange.createMany({ data: rangeRows });
      await writeAuditLogs(tx, auditRows(ctx, 'commerce.fitment.bulk_added', perProduct));
      return { perProduct, rules: fitmentRows.length, total: ids.length, requested };
    },
    undefined,
    { timeoutMs: BULK_TIMEOUT_MS }
  );

  await announce(ctx, result.perProduct.keys());
  return {
    rules: result.rules,
    productsChanged: result.perProduct.size,
    productsUnchanged: result.total - result.perProduct.size,
    skipped: result.requested - result.total,
  };
}

/** Take these entries, and everything under them, off every product a selection
 *  names, whatever windows the rules carried. Rules anywhere else are kept.
 *
 *  "Under" is the point: an owner who takes "Chevrolet" off a part means it no
 *  longer fits any Chevrolet, and choosing the whole list means it fits nothing in
 *  it. Read as "the rule set at exactly this entry", choosing a make or the list
 *  removed nothing from a part set to fit its engines, and the dialog offered
 *  exactly that choice (sparx persona issue 070). */
export async function removeFromProducts(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<FitmentBulkResult> {
  const input = BulkRemoveFitmentInput.parse(rawInput);
  const nodeIds = input.nodeIds.filter((id): id is string => id !== null);
  const wholeList = input.nodeIds.includes(null);

  const result = await withTenant(
    ctx,
    async (tx) => {
      await requireDomainShape(tx, input.domainId, nodeIds, []);
      const { ids, requested } = await resolveSelection(tx, input.selection);
      // An entry's `path` holds its ancestors and itself, so "has X" is X and
      // everything under it.
      const targets: Prisma.ProductFitmentWhereInput[] = nodeIds.map((nodeId) => ({
        node: { path: { has: nodeId } },
      }));
      const doomed = await tx.productFitment.findMany({
        where: {
          productId: { in: ids },
          domainId: input.domainId,
          ...(wholeList ? {} : { OR: targets }),
        },
        select: { id: true, productId: true },
      });
      const perProduct = new Map<string, number>();
      for (const row of doomed) {
        perProduct.set(row.productId, (perProduct.get(row.productId) ?? 0) + 1);
      }
      if (doomed.length > 0) {
        // Range rows go with their rule (onDelete: Cascade).
        await tx.productFitment.deleteMany({ where: { id: { in: doomed.map((r) => r.id) } } });
      }
      await writeAuditLogs(tx, auditRows(ctx, 'commerce.fitment.bulk_removed', perProduct));
      return { perProduct, rules: doomed.length, total: ids.length, requested };
    },
    undefined,
    { timeoutMs: BULK_TIMEOUT_MS }
  );

  await announce(ctx, result.perProduct.keys());
  return {
    rules: result.rules,
    productsChanged: result.perProduct.size,
    productsUnchanged: result.total - result.perProduct.size,
    skipped: result.requested - result.total,
  };
}
