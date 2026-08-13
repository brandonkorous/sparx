// Bin routing — which shelf does THIS go on (docs/146 Phase 2).
//
// Small, shared, and deliberately separate from ./bins.ts so the flows that need
// a shelf (receiving, returns, counts) can import it without dragging in the
// whole CRUD surface — and so `bins.ts` can keep importing the ledger without a
// cycle back through receiving.
//
// Everything here returns NULL when the location does not use bins. That single
// convention is what lets every caller pass the result straight to
// `applyMovement({ binId })` without first asking whether bins are on.

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

/**
 * Find a location's platform-provisioned shelf of a given kind.
 *
 * `quarantine`, `damaged` and `repair` are looked up by TYPE rather than by the
 * literal code, because a tenant is allowed to rename them — and code that hunts
 * for the string 'DAMAGED' breaks silently the moment someone calls it
 * "Write-offs". Returns null when the location does not use bins.
 */
/**
 * The public form of {@link systemBinFor} — opens its own tenant transaction.
 *
 * For callers outside the inventory module (returns disposition in
 * `@sparx/commerce`) that need to know which shelf a kind of goods belongs on
 * before they call `adjust`. Returns null on a location that does not use
 * shelves, which the caller treats as "no shelf named, let the ledger decide".
 */
export async function resolveSystemBin(
  ctx: ServiceContext,
  warehouseId: string,
  type: 'quarantine' | 'damaged' | 'repair'
): Promise<string | null> {
  return withTenant(ctx, (tx) => systemBinFor(tx, warehouseId, type));
}

export async function systemBinFor(
  tx: TxClient,
  warehouseId: string,
  type: 'quarantine' | 'damaged' | 'repair'
): Promise<string | null> {
  const warehouse = await tx.warehouse.findFirst({
    where: { id: warehouseId },
    select: { usesBins: true },
  });
  if (!warehouse?.usesBins) return null;

  const bin = await tx.inventoryBin.findFirst({
    where: { warehouseId, type, isActive: true, deletedAt: null },
    orderBy: { isSystem: 'desc' }, // the provisioned one first if there are several
    select: { id: true },
  });
  if (bin) return bin.id;

  // A bin-enabled location with no shelf of this kind means someone archived the
  // provisioned one. Fall back to the default rather than refusing: a write-off
  // that cannot be recorded because a shelf is missing is a far worse outcome
  // than a write-off recorded in the wrong place, and the shelf is nameable.
  const fallback = await tx.inventoryBin.findFirst({
    where: { warehouseId, isDefault: true },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

/**
 * The shelf a put-away should land on: what the receiver asked for, validated,
 * or the best available suggestion.
 *
 * The requested bin is CHECKED rather than trusted — a bin id from another
 * location, or an archived one, would otherwise seat stock somewhere it can
 * never be found, and the bin sum would still balance so nothing would flag it.
 *
 * Returns null when the location does not use bins.
 */
export async function resolvePutAwayBin(
  tx: TxClient,
  ctx: ServiceContext,
  input: {
    warehouseId: string;
    variantId: string;
    requested: string | null;
    /** Used only for the capacity warning; a shortfall never blocks. */
    quantity: number;
  }
): Promise<string | null> {
  const warehouse = await tx.warehouse.findFirst({
    where: { id: input.warehouseId },
    select: { usesBins: true },
  });
  if (!warehouse?.usesBins) return null;

  if (input.requested) {
    const bin = await tx.inventoryBin.findFirst({
      where: {
        id: input.requested,
        tenantId: ctx.tenantId,
        warehouseId: input.warehouseId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, code: true },
    });
    if (!bin) {
      throw new InventoryValidationError(
        'That shelf is not one of this location’s — pick a shelf in the same place the stock is arriving.',
        [{ field: 'binId', message: 'Unknown or archived shelf for this location' }]
      );
    }
    return bin.id;
  }

  // Nobody named one. Take the strongest available signal, in the same order the
  // put-away suggester shows a person — so what happens when they say nothing
  // matches what it would have recommended if they had looked.
  const variant = await tx.productVariant.findFirst({
    where: { id: input.variantId },
    select: { defaultBinId: true },
  });
  if (variant?.defaultBinId) {
    const home = await tx.inventoryBin.findFirst({
      where: {
        id: variant.defaultBinId,
        warehouseId: input.warehouseId,
        isActive: true,
        deletedAt: null,
        // Same guard as the ledger's mirror: a home shelf since turned into a
        // quarantine or damaged shelf must not receive an ordinary put-away.
        isSellable: true,
      },
      select: { id: true },
    });
    if (home) return home.id;
  }

  const holding = await tx.inventoryBinLevel.findFirst({
    where: {
      tenantId: ctx.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      onHand: { gt: 0 },
      bin: { isActive: true, deletedAt: null, isSellable: true },
    },
    orderBy: { onHand: 'desc' },
    select: { binId: true },
  });
  if (holding) return holding.binId;

  const fallback = await tx.inventoryBin.findFirst({
    where: { warehouseId: input.warehouseId, isDefault: true },
    select: { id: true },
  });
  if (!fallback) {
    throw new InventoryValidationError(
      'This location has no default shelf, so there is nowhere to record the stock. Turn bins off for it, or add one.'
    );
  }
  return fallback.id;
}
