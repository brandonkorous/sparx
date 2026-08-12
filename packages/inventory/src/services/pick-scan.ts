// Scanning a walk (docs/146 Phase 4.3) and scanning a box (Phase 4.4).
//
// Kept out of `scan-workflows.ts` deliberately: that file is Phase 3's four
// inbound workflows and is already long, and these two are the only scan paths
// that verify against a DOCUMENT rather than accumulate into one. Same
// idempotency gate, same "record the scan even when it fails" discipline — a
// scan the floor cannot explain is the least diagnosable complaint in warehouse
// software, and the cure is always a row saying it reached us.
//
// ── Why picking verifies and receiving accumulates ───────────────────────────
//
// A receiving scan says "one more of these arrived". A pick scan says "this is
// the thing you asked me for" — it is an ASSERTION being checked, and the useful
// answer is often no. Scanning the wrong item is refused and told why, because
// the entire reason to scan at the pick face rather than tap a button is to catch
// exactly that, and a workflow that accepts a mismatch has spent the trigger pull
// for nothing.

import { ScanToPackInput, ScanToPickInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { InventoryConflictError, InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import { confirmPick } from './pick-lifecycle';
import type { PickActionResult } from './pick-lifecycle';
import { packItem } from './packing';
import type { PackageDetail } from './packing';
import { resolveScan } from './scan';
import type { VariantScanMatch } from './scan';

type ScanContext = 'pick' | 'pack';
type ScanOutcome = 'applied' | 'duplicate' | 'not_found' | 'rejected';

interface RecordInput {
  idempotencyKey: string;
  value: string;
  contextType: ScanContext;
  contextId: string;
  outcome: ScanOutcome;
  message: string | null;
  variantId: string | null;
  binId: string | null;
  quantity: number;
  deviceId: string | null;
  scannedAt: Date;
  actorId: string | null;
}

/** Write the scan, or discover it has already been written. Null means the
 *  offline queue is working: the caller skips the side effect entirely. */
async function recordScan(
  tx: TxClient,
  tenantId: string,
  input: RecordInput
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO inventory_scan_events
      (tenant_id, idempotency_key, value, context_type, context_id, outcome, message,
       variant_id, bin_id, quantity, damaged_quantity, device_id, actor_id, scanned_at)
    VALUES (${tenantId}::uuid, ${input.idempotencyKey}, ${input.value}, ${input.contextType},
            ${input.contextId}::uuid, ${input.outcome}, ${input.message},
            ${input.variantId}::uuid, ${input.binId}::uuid, ${input.quantity},
            0, ${input.deviceId}, ${input.actorId}, ${input.scannedAt})
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

// ─── Scan to pick ──────────────────────────────────────────────────────────────

export interface ScanToPickResult {
  outcome: ScanOutcome;
  message: string;
  match: VariantScanMatch | null;
  scanEventId: string | null;
  /** Present only when the scan actually confirmed a line. */
  pick: PickActionResult | null;
}

/**
 * One trigger pull against an open walk.
 *
 * The scan RESOLVES the line rather than the caller naming it: the picker is
 * holding a thing and pointing a gun at it, and asking them to also tap the right
 * row first would defeat the purpose. Among the open lines for that item, the one
 * earliest in the walk wins — which on a wave means the tote nearest the front of
 * the trolley, and matches what a person does without thinking about it.
 *
 * When a shelf is scanned first, being on the WRONG shelf is refused. That is the
 * put-away error and the mis-pick caught in the same gesture, and it costs
 * nothing to check.
 */
export async function scanToPick(
  ctx: ServiceContext,
  pickListId: string,
  rawInput: unknown
): Promise<ScanToPickResult> {
  const input = ScanToPickInput.parse(rawInput);
  const when = input.scannedAt ? new Date(input.scannedAt) : new Date();
  const device = input.deviceId ?? null;
  const units = input.quantity ?? 1;

  const resolution = await resolveScan(ctx, input.value, { expect: ['variant'] });
  const match = resolution.matches.find((m): m is VariantScanMatch => m.kind === 'variant') ?? null;

  const base = {
    idempotencyKey: input.idempotencyKey,
    value: input.value,
    contextType: 'pick' as const,
    contextId: pickListId,
    deviceId: device,
    scannedAt: when,
    actorId: ctx.userId ?? null,
    binId: input.binId ?? null,
  };

  const recorded = await withTenant(ctx, async (tx) => {
    const list = await tx.pickList.findFirst({
      where: { id: pickListId, tenantId: ctx.tenantId },
      select: { id: true, number: true, status: true },
    });
    if (!list) throw new InventoryNotFoundError('PickList', pickListId);
    if (list.status === 'cancelled' || list.status === 'picked') {
      throw new InventoryConflictError(
        `Walk ${list.number} is ${list.status} and can no longer be worked.`,
        'status'
      );
    }

    if (!match) {
      const message = `Nothing in the catalogue matches ${resolution.scanned}.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'not_found',
        message,
        variantId: null,
        quantity: 0,
      });
      return { id, message, line: null, contributed: 0 } as const;
    }

    // The earliest open instruction for this item. `skipped` counts as open — a
    // picker who skipped a line and then scanned the item has come back to it.
    const lines = await tx.$queryRaw<
      { id: string; binId: string | null; binCode: string | null; outstanding: number }[]
    >`
      SELECT ln.id      AS "id",
             ln.bin_id  AS "binId",
             b.code     AS "binCode",
             (ln.quantity - ln.picked_quantity - ln.short_quantity) AS "outstanding"
        FROM inventory_pick_list_lines ln
        LEFT JOIN inventory_bins b ON b.id = ln.bin_id
       WHERE ln.tenant_id    = ${ctx.tenantId}::uuid
         AND ln.pick_list_id = ${pickListId}::uuid
         AND ln.variant_id   = ${match.variantId}::uuid
         AND ln.status IN ('pending','skipped')
         AND (ln.quantity - ln.picked_quantity - ln.short_quantity) > 0
       ORDER BY ln.pick_sequence ASC
       LIMIT 1
    `;
    const line = lines[0];

    if (!line) {
      const message = `${match.title} is not outstanding on this walk.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'rejected',
        message,
        variantId: match.variantId,
        quantity: 0,
      });
      return { id, message, line: null, contributed: 0 } as const;
    }

    // A shelf was scanned and it is not the one on the instruction. Refuse, and
    // say where to go — this is the check the whole gesture exists for.
    if (input.binId && line.binId && input.binId !== line.binId) {
      const message = `${match.title} is on ${line.binCode ?? 'another shelf'}, not the shelf you scanned.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'rejected',
        message,
        variantId: match.variantId,
        quantity: 0,
      });
      return { id, message, line: null, contributed: 0 } as const;
    }

    // The case-of-twelve rule, same as receiving: one pull on a case code is
    // twelve units, capped at what the instruction still wants.
    const contributed = Math.min(units * match.packSize, line.outstanding);
    const id = await recordScan(tx, ctx.tenantId, {
      ...base,
      outcome: 'applied',
      message: null,
      variantId: match.variantId,
      quantity: contributed,
    });
    return { id, message: null, line, contributed } as const;
  });

  if (!recorded.id) {
    return {
      outcome: 'duplicate',
      message: 'Already picked — this scan had reached us before.',
      match,
      scanEventId: null,
      pick: null,
    };
  }

  if (!recorded.line || !match) {
    return {
      outcome: recorded.message?.includes('catalogue') ? 'not_found' : 'rejected',
      message: recorded.message ?? 'That scan could not be applied.',
      match,
      scanEventId: recorded.id,
      pick: null,
    };
  }

  // The confirmation runs through the ordinary path, so a scanned pick and a
  // tapped one write byte-identical bin corrections, completion and events. The
  // scan is an INPUT METHOD, not a second way to pick.
  const pick = await confirmPick(ctx, pickListId, {
    lineId: recorded.line.id,
    quantity: recorded.contributed,
    verifiedByScan: true,
    ...(input.binId ? { binId: input.binId } : {}),
  });

  return {
    outcome: 'applied',
    message: `${recorded.contributed} × ${match.title} picked.`,
    match,
    scanEventId: recorded.id,
    pick,
  };
}

// ─── Scan to pack ──────────────────────────────────────────────────────────────

export interface ScanToPackResult {
  outcome: ScanOutcome;
  message: string;
  match: VariantScanMatch | null;
  scanEventId: string | null;
  package: PackageDetail | null;
}

/**
 * One trigger pull at the pack bench.
 *
 * Scanning something the order does not contain, or more of it than the order
 * wants, is REFUSED. That refusal is the entire product: pack verification exists
 * so the wrong item cannot reach a customer, and a bench that warns and continues
 * has replaced a control with a notification.
 */
export async function scanToPack(
  ctx: ServiceContext,
  packageId: string,
  rawInput: unknown
): Promise<ScanToPackResult> {
  const input = ScanToPackInput.parse(rawInput);
  const when = input.scannedAt ? new Date(input.scannedAt) : new Date();
  const units = input.quantity ?? 1;

  const resolution = await resolveScan(ctx, input.value, { expect: ['variant'] });
  const match = resolution.matches.find((m): m is VariantScanMatch => m.kind === 'variant') ?? null;

  const base = {
    idempotencyKey: input.idempotencyKey,
    value: input.value,
    contextType: 'pack' as const,
    contextId: packageId,
    deviceId: input.deviceId ?? null,
    scannedAt: when,
    actorId: ctx.userId ?? null,
    binId: null,
  };

  const recorded = await withTenant(ctx, async (tx) => {
    const box = await tx.shipmentPackage.findFirst({
      where: { id: packageId, tenantId: ctx.tenantId },
      select: { id: true, number: true, status: true, orderId: true },
    });
    if (!box) throw new InventoryNotFoundError('ShipmentPackage', packageId);
    if (box.status !== 'open') {
      throw new InventoryConflictError(
        `Box ${box.number} is ${box.status} and can no longer be added to.`,
        'status'
      );
    }

    if (!match) {
      const message = `Nothing in the catalogue matches ${resolution.scanned}.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'not_found',
        message,
        variantId: null,
        quantity: 0,
      });
      return { id, message, orderItemId: null, quantity: 0, contributed: 0 } as const;
    }

    // What the order still needs in a box, for this item: ordered, less what is
    // already in THIS box and every other open or packed box on the order.
    const rows = await tx.$queryRaw<
      { orderItemId: string; ordered: number; packedElsewhere: number; inThisBox: number }[]
    >`
      SELECT oi.id                                   AS "orderItemId",
             oi.quantity                             AS "ordered",
             COALESCE(other.units, 0)::int           AS "packedElsewhere",
             COALESCE(mine.units, 0)::int            AS "inThisBox"
        FROM order_items oi
        LEFT JOIN LATERAL (
          SELECT SUM(pl.quantity) AS units
            FROM inventory_shipment_package_lines pl
            JOIN inventory_shipment_packages pk ON pk.id = pl.package_id
           WHERE pl.order_item_id = oi.id
             AND pk.status <> 'cancelled'
             AND pk.id <> ${packageId}::uuid
        ) other ON TRUE
        LEFT JOIN LATERAL (
          SELECT SUM(pl.quantity) AS units
            FROM inventory_shipment_package_lines pl
           WHERE pl.order_item_id = oi.id AND pl.package_id = ${packageId}::uuid
        ) mine ON TRUE
       WHERE oi.tenant_id  = ${ctx.tenantId}::uuid
         AND oi.order_id   = ${box.orderId}::uuid
         AND oi.variant_id = ${match.variantId}::uuid
       ORDER BY oi.created_at ASC
    `;

    if (rows.length === 0) {
      const message = `${match.title} is not on this order. Do not put it in the box.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'rejected',
        message,
        variantId: match.variantId,
        quantity: 0,
      });
      return { id, message, orderItemId: null, quantity: 0, contributed: 0 } as const;
    }

    const target = rows.find((r) => r.ordered - r.packedElsewhere - r.inThisBox > 0);
    if (!target) {
      const first = rows[0];
      const message = `Every ${match.title} on this order is already in a box (${first?.ordered ?? 0} of ${first?.ordered ?? 0}).`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'rejected',
        message,
        variantId: match.variantId,
        quantity: 0,
      });
      return { id, message, orderItemId: null, quantity: 0, contributed: 0 } as const;
    }

    const room = target.ordered - target.packedElsewhere - target.inThisBox;
    const contributed = Math.min(units * match.packSize, room);
    const id = await recordScan(tx, ctx.tenantId, {
      ...base,
      outcome: 'applied',
      message: null,
      variantId: match.variantId,
      quantity: contributed,
    });
    return {
      id,
      message: null,
      orderItemId: target.orderItemId,
      quantity: target.inThisBox + contributed,
      contributed,
    } as const;
  });

  if (!recorded.id) {
    return {
      outcome: 'duplicate',
      message: 'Already in the box — this scan had reached us before.',
      match,
      scanEventId: null,
      package: null,
    };
  }

  if (!recorded.orderItemId || !match) {
    return {
      outcome: recorded.message?.includes('catalogue') ? 'not_found' : 'rejected',
      message: recorded.message ?? 'That scan could not be applied.',
      match,
      scanEventId: recorded.id,
      package: null,
    };
  }

  const box = await packItem(
    ctx,
    packageId,
    { orderItemId: recorded.orderItemId, quantity: recorded.quantity },
    { scannedDelta: recorded.contributed }
  );

  return {
    outcome: 'applied',
    message: `${match.title} — ${recorded.quantity} in the box.`,
    match,
    scanEventId: recorded.id,
    package: box,
  };
}
