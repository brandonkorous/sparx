// The opening balance (docs/146 Phase 11.4).
//
// The last step of setup, and the one that decides whether every number the
// system reports afterwards means anything.
//
// ── Why this is a COUNT and not a quantity field ─────────────────────────────
//
// A stock system's figures are all differences from a starting point. Sell-
// through, shrinkage, GMROI, the valuation an accountant reconciles to — every
// one is measured from what was there on day one. If day one was an assumption
// typed into a spreadsheet cell, all of them inherit the assumption and none of
// them says so.
//
// Posting it as a count makes the starting point EVIDENCE: a numbered document,
// with who counted, when, what was expected, what was found, and an approval on
// anything large. It is the difference between "we think we started with 412"
// and "here is the count that says we started with 412".
//
// The movements it writes carry the `opening` reason rather than `recount`, so
// the first day does not appear in the shrinkage report as the worst day of
// losses the business has ever had — and so the journal credits opening
// balances rather than stock corrections.

import { StartOpeningBalanceInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';

import { InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { createInventoryCount } from './inventory-counts';
import type { InventoryCountDetail } from './inventory-count-shared';

export interface OpeningBalanceStatus {
  /** The opening count in progress, if there is one. */
  activeCountId: string | null;
  activeCountNumber: string | null;
  activeCountStatus: string | null;
  /** Posted opening counts, by location. The evidence, once it exists. */
  posted: {
    countId: string;
    number: string;
    warehouseId: string;
    warehouseName: string;
    postedAt: string;
    lines: number;
  }[];
  /** Locations with stock but no opening count. The honest gap: these are the
   *  places whose figures rest on an assumption. */
  locationsWithoutOpening: { warehouseId: string; name: string; stockedItems: number }[];
}

export async function openingBalanceStatus(ctx: ServiceContext): Promise<OpeningBalanceStatus> {
  return withTenant(ctx, async (tx) => {
    const counts = await tx.inventoryCount.findMany({
      where: { tenantId: ctx.tenantId, type: 'opening' },
      include: {
        warehouse: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const active = counts.find(
      (count) => count.status !== 'posted' && count.status !== 'cancelled'
    );
    const posted = counts
      .filter((count) => count.status === 'posted')
      .map((count) => ({
        countId: count.id,
        number: count.number,
        warehouseId: count.warehouseId,
        warehouseName: count.warehouse.name,
        postedAt: (count.postedAt ?? count.updatedAt).toISOString(),
        lines: count._count.lines,
      }));

    const withOpening = new Set(posted.map((entry) => entry.warehouseId));
    const stocked = await tx.inventoryLevel.groupBy({
      by: ['warehouseId'],
      where: { tenantId: ctx.tenantId, onHand: { not: 0 } },
      _count: { _all: true },
    });
    const warehouses = await tx.warehouse.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null, isSystem: false },
      select: { id: true, name: true },
    });
    const nameById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));

    return {
      activeCountId: active?.id ?? null,
      activeCountNumber: active?.number ?? null,
      activeCountStatus: active?.status ?? null,
      posted,
      locationsWithoutOpening: stocked
        .filter((group) => !withOpening.has(group.warehouseId))
        .map((group) => ({
          warehouseId: group.warehouseId,
          name: nameById.get(group.warehouseId) ?? 'A location',
          stockedItems: group._count._all,
        })),
    };
  });
}

/**
 * Open the count that closes setup.
 *
 * Blind by default — the one count where being shown the expected figure defeats
 * the entire exercise, because the expected figure is usually whatever a
 * spreadsheet said and the point is to find out whether it was right.
 *
 * Refuses a second one for the same location while one is open. Two opening
 * counts for one place is not a state with a sensible resolution: whichever
 * posts second silently overwrites the first, and nothing on the record says
 * which one anybody actually walked the shelves for.
 */
export async function startOpeningBalance(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<InventoryCountDetail> {
  const input = StartOpeningBalanceInput.parse(rawInput);

  const open = await withTenant(ctx, (tx) =>
    tx.inventoryCount.findFirst({
      where: {
        tenantId: ctx.tenantId,
        type: 'opening',
        warehouseId: input.warehouseId,
        status: { in: ['counting', 'review', 'approved'] },
      },
      select: { id: true, number: true },
    })
  );
  if (open) {
    throw new InventoryValidationError(
      `Opening count ${open.number} is already open for this location — finish that one`,
      [{ field: 'warehouseId', message: `count ${open.id} in progress` }]
    );
  }

  return createInventoryCount(ctx, {
    warehouseId: input.warehouseId,
    type: 'opening',
    scope: 'location',
    isBlind: input.isBlind,
    note: input.note ?? 'Opening balance — the quantities this business starts from',
    // An opening count is expected to differ from what the system holds; that
    // difference is the whole point rather than a variance to sign off. A
    // threshold here would gate the setup's last step behind an approval from
    // the one person setting it up. The largest value the column can hold,
    // rather than a sentinel — the comparison stays an ordinary one.
    approvalThresholdCents: 2_147_483_647,
  });
}
