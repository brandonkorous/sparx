// How this business values its stock (docs/146 Phase 5.5).
//
// One row per tenant, absent by default, and absent means moving average — which
// is what the platform has always done, so nothing changes for anyone who never
// opens this setting.
//
// The resolution is two-level on purpose: the tenant picks a method, and a
// variant may override it. A business that manufactures a dozen parts and
// resells four hundred wants standard costing on the twelve and moving average
// on the rest; forcing one method on the whole catalogue is how the other half
// ends up in a spreadsheet.

import {
  UpdateCostingPolicyInput,
  SetVariantCostingMethodInput,
} from '@wizeworks/commerce-schemas';
import type { CostingMethod } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

export const DEFAULT_COSTING_METHOD: CostingMethod = 'moving_average';
export const DEFAULT_BASE_CURRENCY = 'USD';

export interface CostingPolicyRow {
  method: CostingMethod;
  defaultAllocationBasis: 'value' | 'quantity' | 'weight' | 'manual';
  baseCurrency: string;
  /** False until someone has actually chosen — the UI says "using the default"
   *  rather than implying the business made a decision it never made. */
  configured: boolean;
  updatedAt: string | null;
}

/** The tenant's policy, or the platform defaults when they have never set one. */
export async function getCostingPolicy(ctx: ServiceContext): Promise<CostingPolicyRow> {
  return withTenant(ctx, (tx) => loadPolicy(tx, ctx.tenantId));
}

export async function loadPolicy(tx: TxClient, tenantId: string): Promise<CostingPolicyRow> {
  const row = await tx.costingPolicy.findFirst({ where: { tenantId } });
  if (!row) {
    return {
      method: DEFAULT_COSTING_METHOD,
      defaultAllocationBasis: 'value',
      baseCurrency: DEFAULT_BASE_CURRENCY,
      configured: false,
      updatedAt: null,
    };
  }
  return {
    method: row.method as CostingMethod,
    defaultAllocationBasis:
      row.defaultAllocationBasis as CostingPolicyRow['defaultAllocationBasis'],
    baseCurrency: row.baseCurrency,
    configured: true,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Set the policy. Creates the row on first use.
 *
 * Changing the method does NOT restate history: movements already stamped with a
 * cost keep it, and layers already consumed stay consumed. The change applies to
 * what happens next, which is both what an accountant expects and the only
 * version that does not silently rewrite last quarter's margin.
 */
export async function updateCostingPolicy(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<CostingPolicyRow> {
  const input = UpdateCostingPolicyInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await loadPolicy(tx, ctx.tenantId);
    await tx.costingPolicy.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        method: input.method ?? before.method,
        defaultAllocationBasis: input.defaultAllocationBasis ?? before.defaultAllocationBasis,
        baseCurrency: input.baseCurrency ?? before.baseCurrency,
      },
      update: {
        ...(input.method ? { method: input.method } : {}),
        ...(input.defaultAllocationBasis
          ? { defaultAllocationBasis: input.defaultAllocationBasis }
          : {}),
        ...(input.baseCurrency ? { baseCurrency: input.baseCurrency } : {}),
      },
    });
    const after = await loadPolicy(tx, ctx.tenantId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.costing_policy.updated',
      entityType: 'CostingPolicy',
      entityId: ctx.tenantId,
      diff: { before: { ...before }, after: { ...after } },
    });

    return after;
  });
}

/** Point one variant at a different method, or clear the override. */
export async function setVariantCostingMethod(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ variantId: string; method: CostingMethod | null; effective: CostingMethod }> {
  const input = SetVariantCostingMethodInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId },
      select: { id: true, costingMethod: true },
    });
    if (!variant) throw new InventoryNotFoundError('ProductVariant', input.variantId);

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { costingMethod: input.method },
    });

    const policy = await loadPolicy(tx, ctx.tenantId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.variant_costing_method.set',
      entityType: 'ProductVariant',
      entityId: variant.id,
      diff: {
        before: { costingMethod: variant.costingMethod },
        after: { costingMethod: input.method },
      },
    });

    return {
      variantId: variant.id,
      method: input.method,
      effective: input.method ?? policy.method,
    };
  });
}

// ─── Resolution on the hot path ──────────────────────────────────────────────

export interface ResolvedCosting {
  method: CostingMethod;
  /** The planned/standard cost for this variant at this location, in cents.
   *  Under `standard` this IS the cost basis; under the others it is the last
   *  fallback before zero. */
  standardCostCents: number | null;
  baseCurrency: string;
}

interface CostingRow {
  method: string;
  standard_cost_cents: number | null;
  base_currency: string;
}

/**
 * Resolve the costing method for one (variant, location) in a single query.
 *
 * One query rather than three because this runs inside `applyMovement` on the
 * checkout path, and that path is already doing a locked read, an update and two
 * inserts. The COALESCE chain is the resolution order written down:
 * variant override → tenant policy → platform default, and for the standard
 * cost, this location's figure → the catalogue's → nothing.
 */
export async function resolveCosting(
  tx: TxClient,
  params: { tenantId: string; variantId: string; warehouseId: string }
): Promise<ResolvedCosting> {
  const rows = await tx.$queryRaw<CostingRow[]>`
    SELECT
      COALESCE(v.costing_method, p.method, 'moving_average')            AS method,
      COALESCE(l.unit_cost_cents, v.cost_cents)                         AS standard_cost_cents,
      COALESCE(p.base_currency, 'USD')                                  AS base_currency
    FROM commerce_product_variants v
    LEFT JOIN inventory_costing_policies p ON p.tenant_id = ${params.tenantId}::uuid
    LEFT JOIN inventory_levels l
      ON l.variant_id = v.id AND l.warehouse_id = ${params.warehouseId}::uuid
    WHERE v.id = ${params.variantId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    // A movement against a variant that does not exist is a caller bug, not a
    // costing question — the ledger will fail on its own foreign key. Answering
    // with the defaults keeps this function total.
    return {
      method: DEFAULT_COSTING_METHOD,
      standardCostCents: null,
      baseCurrency: DEFAULT_BASE_CURRENCY,
    };
  }
  return {
    method: row.method as CostingMethod,
    standardCostCents: row.standard_cost_cents,
    baseCurrency: row.base_currency,
  };
}
