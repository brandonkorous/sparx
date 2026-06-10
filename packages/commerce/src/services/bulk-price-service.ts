// bulkPriceService — bulk price adjustment across the variants of selected
// products, with a dry-run preview and a 30-minute undo window (docs/69 B-3).
//
// A "product" price is really its variants' `price_cents`; adjusting a product
// adjusts every live variant under it. The before-values are written to
// `bulk_op_reverts` (one row per variant, grouped by operation_id) so the whole
// batch can be restored within the window. Revert is conservative: it only
// restores a variant whose price is still the value we set (a merchant's later
// manual edit is never clobbered).
//
// Writes follow the locked commerce pattern: validate → withTenant() tx →
// writeAuditLog inside the tx → publishCommerceEvent after commit.

import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import { withTenant } from '@sparx/db';
import type { Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';

const OPERATION_TYPE = 'price_adjust';
const REVERT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// ─── Input ────────────────────────────────────────────────────────────────

export const PriceAdjustment = z.discriminatedUnion('mode', [
  // percent is signed: +10 raises 10%, -10 lowers 10%.
  z.object({ mode: z.literal('percent'), percent: z.number().gte(-100).lte(10000) }),
  // amountCents is signed: +500 adds $5.00, -500 subtracts $5.00.
  z.object({
    mode: z.literal('fixed'),
    amountCents: z.number().int().gte(-100_000_000).lte(100_000_000),
  }),
  // set: every variant gets this exact price.
  z.object({ mode: z.literal('set'), priceCents: z.number().int().min(0).max(100_000_000) }),
]);
export type PriceAdjustment = z.infer<typeof PriceAdjustment>;

export const BulkPriceAdjustInput = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(1000),
  adjustment: PriceAdjustment,
});
export type BulkPriceAdjustInput = z.infer<typeof BulkPriceAdjustInput>;

// ─── Output shapes ──────────────────────────────────────────────────────────

export interface PricePreviewRow {
  productId: string;
  title: string;
  variantCount: number;
  currentMinCents: number | null;
  currentMaxCents: number | null;
  newMinCents: number | null;
  newMaxCents: number | null;
}

export interface BulkPricePreview {
  label: string;
  productCount: number;
  variantCount: number;
  /** Variants whose price actually changes (no-ops excluded). */
  changedVariantCount: number;
  products: PricePreviewRow[];
}

export interface BulkPriceApplyResult {
  operationId: string;
  label: string;
  productCount: number;
  variantCount: number;
  appliedAt: string;
  expiresAt: string;
}

export interface ReversibleOp {
  operationId: string;
  operationType: string;
  label: string;
  appliedAt: string;
  expiresAt: string;
  productCount: number;
  variantCount: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

export function computeNewPrice(currentCents: number, adj: PriceAdjustment): number {
  let next: number;
  switch (adj.mode) {
    case 'percent':
      next = Math.round(currentCents * (1 + adj.percent / 100));
      break;
    case 'fixed':
      next = currentCents + adj.amountCents;
      break;
    case 'set':
      next = adj.priceCents;
      break;
  }
  return Math.max(0, next); // never produce a negative price
}

function describeAdjustment(adj: PriceAdjustment): string {
  const money = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(2)}`;
  switch (adj.mode) {
    case 'percent':
      return adj.percent >= 0
        ? `Increased prices by ${adj.percent}%`
        : `Decreased prices by ${Math.abs(adj.percent)}%`;
    case 'fixed':
      return adj.amountCents >= 0
        ? `Increased prices by ${money(adj.amountCents)}`
        : `Decreased prices by ${money(adj.amountCents)}`;
    case 'set':
      return `Set prices to ${money(adj.priceCents)}`;
  }
}

async function refreshProductPriceRange(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
  const range = await tx.productVariant.aggregate({
    where: { productId, deletedAt: null },
    _min: { priceCents: true },
    _max: { priceCents: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      priceMinCents: range._min.priceCents ?? null,
      priceMaxCents: range._max.priceCents ?? null,
    },
  });
}

// ─── Operations ───────────────────────────────────────────────────────────

/** Dry run — compute the before→after price range per product, write nothing. */
export async function previewBulkPriceAdjust(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<BulkPricePreview> {
  const input = BulkPriceAdjustInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const [products, variants] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: input.productIds }, deletedAt: null },
        select: { id: true, title: true },
      }),
      tx.productVariant.findMany({
        where: { productId: { in: input.productIds }, deletedAt: null },
        select: { id: true, productId: true, priceCents: true },
      }),
    ]);

    const byProduct = new Map<string, { before: number[]; after: number[] }>();
    let changedVariantCount = 0;
    for (const v of variants) {
      const next = computeNewPrice(v.priceCents, input.adjustment);
      if (next !== v.priceCents) changedVariantCount++;
      const bucket = byProduct.get(v.productId) ?? { before: [], after: [] };
      bucket.before.push(v.priceCents);
      bucket.after.push(next);
      byProduct.set(v.productId, bucket);
    }

    const rows: PricePreviewRow[] = products.map((p) => {
      const bucket = byProduct.get(p.id);
      return {
        productId: p.id,
        title: p.title,
        variantCount: bucket?.before.length ?? 0,
        currentMinCents: bucket?.before.length ? Math.min(...bucket.before) : null,
        currentMaxCents: bucket?.before.length ? Math.max(...bucket.before) : null,
        newMinCents: bucket?.after.length ? Math.min(...bucket.after) : null,
        newMaxCents: bucket?.after.length ? Math.max(...bucket.after) : null,
      };
    });

    return {
      label: describeAdjustment(input.adjustment),
      productCount: rows.length,
      variantCount: variants.length,
      changedVariantCount,
      products: rows.sort((a, b) => a.title.localeCompare(b.title)),
    };
  });
}

/** Apply the adjustment, recording before-values for the undo window. */
export async function applyBulkPriceAdjust(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<BulkPriceApplyResult> {
  const input = BulkPriceAdjustInput.parse(rawInput);
  const label = describeAdjustment(input.adjustment);
  const operationId = randomUUID();
  const appliedAt = new Date();
  const expiresAt = new Date(appliedAt.getTime() + REVERT_WINDOW_MS);

  const result = await withTenant(ctx, async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { productId: { in: input.productIds }, deletedAt: null },
      select: { id: true, productId: true, priceCents: true },
    });
    if (variants.length === 0) {
      throw new CommerceValidationError('No variants found for the selected products.');
    }

    const revertRows: Prisma.BulkOpRevertCreateManyInput[] = [];
    const changedProductIds = new Set<string>();
    for (const v of variants) {
      const next = computeNewPrice(v.priceCents, input.adjustment);
      if (next === v.priceCents) continue; // skip no-ops
      await tx.productVariant.update({ where: { id: v.id }, data: { priceCents: next } });
      revertRows.push({
        tenantId: ctx.tenantId,
        operationId,
        operationType: OPERATION_TYPE,
        label,
        entityType: 'variant',
        entityId: v.id,
        groupId: v.productId,
        field: 'price_cents',
        valueBefore: v.priceCents,
        valueAfter: next,
        appliedBy: ctx.userId ?? null,
        appliedAt,
        expiresAt,
      });
      changedProductIds.add(v.productId);
    }
    if (revertRows.length === 0) {
      throw new CommerceValidationError('The adjustment produced no price changes.');
    }

    await tx.bulkOpRevert.createMany({ data: revertRows });
    for (const productId of changedProductIds) await refreshProductPriceRange(tx, productId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.product.bulk_price_adjusted',
      entityType: 'BulkPriceOp',
      entityId: operationId,
      diff: {
        after: { label, productCount: changedProductIds.size, variantCount: revertRows.length },
      },
    });

    return { changedProductIds: [...changedProductIds], variantCount: revertRows.length };
  });

  for (const productId of result.changedProductIds) {
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'product.updated',
      data: { productId },
    });
  }

  return {
    operationId,
    label,
    productCount: result.changedProductIds.length,
    variantCount: result.variantCount,
    appliedAt: appliedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/** Undo a price-adjust operation within its 30-minute window. */
export async function revertBulkPriceAdjust(
  ctx: ServiceContext,
  operationId: string
): Promise<{ operationId: string; productCount: number; variantCount: number }> {
  const now = new Date();

  const result = await withTenant(ctx, async (tx) => {
    const rows = await tx.bulkOpRevert.findMany({
      where: { operationId, operationType: OPERATION_TYPE, revertedAt: null },
    });
    if (rows.length === 0) {
      throw new CommerceNotFoundError('Reversible operation', operationId);
    }
    if (rows[0]!.expiresAt.getTime() < now.getTime()) {
      throw new CommerceValidationError(
        'This price change can no longer be undone — the 30-minute window has passed.'
      );
    }

    const changedProductIds = new Set<string>();
    let reverted = 0;
    for (const r of rows) {
      // Only restore if the variant still exists AND still holds the value we
      // set — never clobber a merchant's later manual re-price.
      const v = await tx.productVariant.findFirst({
        where: { id: r.entityId, deletedAt: null },
        select: { id: true, priceCents: true },
      });
      if (v?.priceCents === r.valueAfter) {
        await tx.productVariant.update({
          where: { id: v.id },
          data: { priceCents: r.valueBefore },
        });
        if (r.groupId) changedProductIds.add(r.groupId);
        reverted++;
      }
    }

    await tx.bulkOpRevert.updateMany({
      where: { operationId, revertedAt: null },
      data: { revertedAt: now, revertedBy: ctx.userId ?? null },
    });
    for (const productId of changedProductIds) await refreshProductPriceRange(tx, productId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.product.bulk_price_reverted',
      entityType: 'BulkPriceOp',
      entityId: operationId,
      diff: { after: { variantCount: reverted } },
    });

    return { changedProductIds: [...changedProductIds], variantCount: reverted };
  });

  for (const productId of result.changedProductIds) {
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'product.updated',
      data: { productId },
    });
  }

  return {
    operationId,
    productCount: result.changedProductIds.length,
    variantCount: result.variantCount,
  };
}

/** Operations still inside their undo window (most recent first). */
export async function listReversibleOps(ctx: ServiceContext): Promise<ReversibleOp[]> {
  const now = new Date();
  const rows = await withTenant(ctx, (tx) =>
    tx.bulkOpRevert.findMany({
      where: { revertedAt: null, expiresAt: { gt: now } },
      orderBy: { appliedAt: 'desc' },
      select: {
        operationId: true,
        operationType: true,
        label: true,
        appliedAt: true,
        expiresAt: true,
        groupId: true,
      },
    })
  );

  const grouped = new Map<
    string,
    { op: (typeof rows)[number]; productIds: Set<string>; variantCount: number }
  >();
  for (const r of rows) {
    const g = grouped.get(r.operationId) ?? {
      op: r,
      productIds: new Set<string>(),
      variantCount: 0,
    };
    if (r.groupId) g.productIds.add(r.groupId);
    g.variantCount++;
    grouped.set(r.operationId, g);
  }

  return [...grouped.values()].map((g) => ({
    operationId: g.op.operationId,
    operationType: g.op.operationType,
    label: g.op.label,
    appliedAt: g.op.appliedAt.toISOString(),
    expiresAt: g.op.expiresAt.toISOString(),
    productCount: g.productIds.size,
    variantCount: g.variantCount,
  }));
}
