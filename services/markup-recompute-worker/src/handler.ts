// Per-message handler: a `variant.cost.updated` event → recompute the bound
// variant's price and publish the result.
//
// Failure handling:
//   • throw Error → 500 returned to Pub/Sub, the message is redelivered
//   • return normally → 204, the message is acked
//
// The recompute itself is idempotent (recomputeBoundVariant settles to the same
// state on replay), so a redelivery after a transient publish failure is safe.

import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { createPublisher, publishEvent } from '@sparx/events';
import type { Logger } from 'pino';

import { env } from './env.js';
import { recomputeBoundVariant } from './recompute.js';

const VariantCostUpdatedEvent = z.object({
  type: z.literal('variant.cost.updated'),
  tenantId: z.string().uuid(),
  data: z.object({
    variantId: z.string().uuid(),
    productId: z.string().uuid(),
    basis: z.enum(['variant_cost', 'supplier_cost']),
    prevCostCents: z.number().int().nullable().optional(),
    newCostCents: z.number().int().nullable().optional(),
  }),
});
export type VariantCostUpdatedEvent = z.infer<typeof VariantCostUpdatedEvent>;

export function parseEvent(raw: unknown): VariantCostUpdatedEvent | null {
  const result = VariantCostUpdatedEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export interface RecomputeHandlerOutcome {
  outcome: 'applied' | 'staged' | 'skipped';
  variantId: string;
  reason?: string;
  oldPriceCents?: number;
  newPriceCents?: number;
  reviewId?: string;
}

export async function handle(
  event: VariantCostUpdatedEvent,
  logger: Logger
): Promise<RecomputeHandlerOutcome> {
  const ctx = { tenantId: event.tenantId };
  const computedAt = new Date().toISOString();

  const outcome = await withTenant(ctx, (tx) =>
    recomputeBoundVariant(tx, {
      tenantId: event.tenantId,
      variantId: event.data.variantId,
      prevCostCents: event.data.prevCostCents ?? null,
      computedAt,
    })
  );

  if (outcome.kind === 'skipped') {
    return { outcome: 'skipped', variantId: outcome.variantId, reason: outcome.reason };
  }

  const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger });

  if (outcome.kind === 'applied') {
    await publishEvent(
      publisher,
      'price.recomputed',
      event.tenantId,
      null,
      {
        variantId: outcome.variantId,
        productId: outcome.productId,
        ruleId: outcome.ruleId,
        oldPriceCents: outcome.oldPriceCents,
        newPriceCents: outcome.newPriceCents,
      },
      logger
    );
    // The product's price range moved — reindex via the existing commerce fan-in
    // (commerce-indexer subscribes to product.updated).
    await publishEvent(
      publisher,
      'product.updated',
      event.tenantId,
      null,
      { productId: outcome.productId, change: 'price_recomputed' },
      logger
    );
    return {
      outcome: 'applied',
      variantId: outcome.variantId,
      oldPriceCents: outcome.oldPriceCents,
      newPriceCents: outcome.newPriceCents,
    };
  }

  // staged
  await publishEvent(
    publisher,
    'price.recompute.staged',
    event.tenantId,
    null,
    {
      variantId: outcome.variantId,
      productId: outcome.productId,
      ruleId: outcome.ruleId,
      reviewId: outcome.reviewId,
      oldPriceCents: outcome.oldPriceCents,
      proposedPriceCents: outcome.newPriceCents,
      reason: outcome.reason,
    },
    logger
  );
  return {
    outcome: 'staged',
    variantId: outcome.variantId,
    reviewId: outcome.reviewId,
    oldPriceCents: outcome.oldPriceCents,
    newPriceCents: outcome.newPriceCents,
  };
}
