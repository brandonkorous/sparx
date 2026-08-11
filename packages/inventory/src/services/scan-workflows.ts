// Scan-driven operations (docs/146 Phase 3.5–3.7, 3.9).
//
// Receiving, counting, transferring and putting away, each driven by a trigger
// pull instead of a keyboard. The resolver (`./scan.ts`) says WHAT was scanned;
// this says what happens next.
//
// ── The session lives in the database, not in the tab ────────────────────────
//
// Every scan is written to `inventory_scan_events` immediately, and the running
// tally of a receiving session is DERIVED from those rows rather than held in
// React state. That costs a round trip per scan and buys four things a client-
// side tally cannot have: the session survives a reload, survives the battery
// dying, can be worked by two people on two guns at once, and can be replayed
// from an offline queue hours later without anyone reasoning about merge order.
//
// ── Idempotency is the whole offline story ───────────────────────────────────
//
// The client mints a key per trigger pull and keeps it with the queued scan.
// Replay sends the same key; `UNIQUE (tenant_id, idempotency_key)` makes the
// second arrival a no-op that reports `duplicate`. Nothing else in this file has
// to think about retries, because the constraint has already thought about them.
//
// ── Scans are recorded even when they FAIL ───────────────────────────────────
//
// A code that resolves to nothing writes a `not_found` row; an over-receipt
// writes `rejected` with the reason. This is deliberate. "I scanned it and
// nothing happened" is the least diagnosable complaint in warehouse software,
// and the only cure is a record that the scan reached us at all.

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

import { resolveScan, type VariantScanMatch } from './scan';
import { createGoodsReceipt } from './goods-receipts';
import type { GoodsReceiptDetail } from './goods-receipts';
import { getInventoryCount } from './inventory-counts';
import type { InventoryCountDetail } from './inventory-count-shared';
import { moveBetweenBins } from './bins';

export type ScanContextType = 'count' | 'receipt' | 'transfer' | 'put_away' | 'pick' | 'lookup';
export type ScanOutcome = 'applied' | 'duplicate' | 'not_found' | 'rejected';

/** What every scan endpoint takes, whatever it is scanning into. */
export interface ScanEnvelope {
  /** Raw, exactly as the gun sent it. */
  value: string;
  /** Client-minted, one per trigger pull. Replaying with the same key is a no-op. */
  idempotencyKey: string;
  /** Units of the SCANNED code, before pack size. One trigger pull is one. */
  quantity?: number;
  /** Of those, how many arrived broken. Receiving only. */
  damagedQuantity?: number;
  /** Which handheld — the only way to tell a bad gun from a bad operator. */
  deviceId?: string | null;
  /** When the trigger was pulled, per the device. Defaults to now for live scans. */
  scannedAt?: string;
}

export interface ScanActionResult {
  outcome: ScanOutcome;
  /** Shown to the person holding the scanner. Plain language, always populated. */
  message: string;
  /** The resolved item, when there was one. */
  match: VariantScanMatch | null;
  /** Base units this scan contributed after pack-size expansion. */
  quantity: number;
  /** Running total for the item within this session, after this scan. */
  sessionQuantity: number | null;
  scanEventId: string | null;
}

// ─── The idempotency gate ──────────────────────────────────────────────────────

interface RecordScanInput {
  idempotencyKey: string;
  value: string;
  contextType: ScanContextType;
  contextId: string | null;
  outcome: ScanOutcome;
  message: string | null;
  variantId: string | null;
  binId: string | null;
  quantity: number;
  damagedQuantity: number;
  deviceId: string | null;
  scannedAt: Date;
  actorId: string | null;
}

/**
 * Write the scan, or discover it has already been written.
 *
 * Returns null when the key is already present — which is not an error, it is
 * the offline queue working. Callers treat null as "this already happened" and
 * skip the side effect entirely, which is what makes replay safe.
 */
async function recordScan(
  tx: TxClient,
  tenantId: string,
  input: RecordScanInput
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO inventory_scan_events
      (tenant_id, idempotency_key, value, context_type, context_id, outcome, message,
       variant_id, bin_id, quantity, damaged_quantity, device_id, actor_id, scanned_at)
    VALUES (${tenantId}::uuid, ${input.idempotencyKey}, ${input.value}, ${input.contextType},
            ${input.contextId}::uuid, ${input.outcome}, ${input.message},
            ${input.variantId}::uuid, ${input.binId}::uuid, ${input.quantity},
            ${input.damagedQuantity}, ${input.deviceId}, ${input.actorId}, ${input.scannedAt})
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

function envelopeDefaults(envelope: ScanEnvelope): {
  units: number;
  when: Date;
  device: string | null;
} {
  return {
    units: envelope.quantity ?? 1,
    when: envelope.scannedAt ? new Date(envelope.scannedAt) : new Date(),
    device: envelope.deviceId ?? null,
  };
}

function duplicateResult(): ScanActionResult {
  return {
    outcome: 'duplicate',
    message: 'Already counted — this scan had reached us before.',
    match: null,
    quantity: 0,
    sessionQuantity: null,
    scanEventId: null,
  };
}

// ─── 3.5 Scan to receive ───────────────────────────────────────────────────────

export interface ReceivingSessionLine {
  purchaseOrderLineId: string;
  variantId: string;
  sku: string;
  productTitle: string;
  variantTitle: string | null;
  /** On the purchase order. */
  ordered: number;
  /** Already booked on a previous receipt. */
  receivedPreviously: number;
  /** Scanned in THIS session and not yet posted. */
  scanned: number;
  scannedDamaged: number;
  /** ordered − receivedPreviously − scanned. Negative is impossible; the scan is refused first. */
  outstanding: number;
  /** The item's main barcode, so the receiving screen can show what to point at. */
  primaryBarcode: string | null;
}

export interface ReceivingSession {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  status: string;
  warehouseId: string;
  warehouseName: string;
  supplierName: string | null;
  /** True when the location tracks shelves, so the UI knows to ask where it went. */
  usesBins: boolean;
  lines: ReceivingSessionLine[];
  /** Scans that resolved to nothing on this PO — the pile that needs a human. */
  unresolved: { value: string; scannedAt: string; message: string | null }[];
  totalScanned: number;
}

/**
 * The state of a receiving session, rebuilt from the ledger and the scan log.
 *
 * Cheap enough to call after every scan, which is the point: the screen shows
 * what the SERVER believes, not what the tab believes, so two receivers on two
 * guns see the same carton counted once.
 */
export async function receivingSession(
  ctx: ServiceContext,
  purchaseOrderId: string
): Promise<ReceivingSession> {
  return withTenant(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId: ctx.tenantId },
      select: {
        id: true,
        number: true,
        status: true,
        warehouseId: true,
        warehouse: { select: { name: true, usesBins: true } },
        supplier: { select: { name: true } },
      },
    });
    if (!po) throw new InventoryNotFoundError('PurchaseOrder', purchaseOrderId);

    const lines = await tx.$queryRaw<
      {
        purchaseOrderLineId: string;
        variantId: string;
        sku: string;
        productTitle: string;
        variantTitle: string | null;
        ordered: number;
        receivedPreviously: number;
        scanned: number;
        scannedDamaged: number;
        primaryBarcode: string | null;
      }[]
    >`
      SELECT pol.id             AS "purchaseOrderLineId",
             pol.variant_id     AS "variantId",
             v.sku              AS "sku",
             p.title            AS "productTitle",
             v.title            AS "variantTitle",
             pol.quantity_ordered  AS "ordered",
             pol.quantity_received AS "receivedPreviously",
             COALESCE(s.units, 0)::int   AS "scanned",
             COALESCE(s.damaged, 0)::int AS "scannedDamaged",
             (SELECT bc.value FROM commerce_variant_barcodes bc
               WHERE bc.tenant_id = pol.tenant_id AND bc.variant_id = pol.variant_id
                 AND bc.is_primary = true AND bc.is_active = true
               LIMIT 1)         AS "primaryBarcode"
        FROM inventory_purchase_order_lines pol
        JOIN commerce_product_variants v ON v.id = pol.variant_id
        JOIN commerce_products p         ON p.id = v.product_id
        LEFT JOIN LATERAL (
          SELECT SUM(se.quantity) AS units, SUM(se.damaged_quantity) AS damaged
            FROM inventory_scan_events se
           WHERE se.tenant_id = pol.tenant_id
             AND se.context_type = 'receipt'
             AND se.context_id = ${purchaseOrderId}::uuid
             AND se.variant_id = pol.variant_id
             AND se.outcome = 'applied'
        ) s ON TRUE
       WHERE pol.tenant_id = ${ctx.tenantId}::uuid
         AND pol.purchase_order_id = ${purchaseOrderId}::uuid
       ORDER BY p.title ASC, v.sku ASC
    `;

    const unresolved = await tx.$queryRaw<
      { value: string; scannedAt: Date; message: string | null }[]
    >`
      SELECT value AS "value", scanned_at AS "scannedAt", message AS "message"
        FROM inventory_scan_events
       WHERE tenant_id = ${ctx.tenantId}::uuid
         AND context_type = 'receipt'
         AND context_id = ${purchaseOrderId}::uuid
         AND outcome IN ('not_found', 'rejected')
       ORDER BY scanned_at DESC
       LIMIT 50
    `;

    return {
      purchaseOrderId: po.id,
      purchaseOrderNumber: po.number,
      status: po.status,
      warehouseId: po.warehouseId,
      warehouseName: po.warehouse?.name ?? '',
      supplierName: po.supplier?.name ?? null,
      usesBins: po.warehouse?.usesBins ?? false,
      lines: lines.map((l) => ({
        ...l,
        outstanding: Math.max(0, l.ordered - l.receivedPreviously - l.scanned),
      })),
      unresolved: unresolved.map((u) => ({
        value: u.value,
        scannedAt: u.scannedAt.toISOString(),
        message: u.message,
      })),
      totalScanned: lines.reduce((sum, l) => sum + l.scanned, 0),
    };
  });
}

export interface ScanToReceiveInput extends ScanEnvelope {
  purchaseOrderId: string;
  /** Which shelf the good units went on. Ignored on a location without bins. */
  binId?: string | null;
}

/**
 * One trigger pull against an open purchase order.
 *
 * Over-receipt is REFUSED rather than warned about. A receiving screen that lets
 * you book more than was ordered produces a stock number nobody can reconcile
 * against an invoice, and the supplier dispute that follows is worse than the
 * thirty seconds it costs to raise the PO. The refusal names the numbers so the
 * receiver can see immediately whether the PO is wrong or the pallet is.
 */
export async function scanToReceive(
  ctx: ServiceContext,
  input: ScanToReceiveInput
): Promise<ScanActionResult> {
  const { units, when, device } = envelopeDefaults(input);
  const resolution = await resolveScan(ctx, input.value, { expect: ['variant'] });
  const match = resolution.matches.find((m): m is VariantScanMatch => m.kind === 'variant') ?? null;

  return withTenant(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, tenantId: ctx.tenantId },
      select: { id: true, number: true, status: true },
    });
    if (!po) throw new InventoryNotFoundError('PurchaseOrder', input.purchaseOrderId);
    if (po.status !== 'submitted' && po.status !== 'partial') {
      throw new InventoryConflictError(
        `Purchase order ${po.number} is ${po.status} and cannot be received against.`,
        'status'
      );
    }

    const base = {
      idempotencyKey: input.idempotencyKey,
      value: input.value,
      contextType: 'receipt' as const,
      contextId: input.purchaseOrderId,
      deviceId: device,
      scannedAt: when,
      actorId: ctx.userId ?? null,
      binId: input.binId ?? null,
    };

    if (!match) {
      const message = `Nothing in the catalogue matches ${resolution.scanned}.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'not_found',
        message,
        variantId: null,
        quantity: 0,
        damagedQuantity: 0,
      });
      if (!id) return duplicateResult();
      return {
        outcome: 'not_found',
        message,
        match: null,
        quantity: 0,
        sessionQuantity: null,
        scanEventId: id,
      };
    }

    const line = await tx.purchaseOrderLine.findFirst({
      where: { purchaseOrderId: po.id, variantId: match.variantId },
      select: { id: true, quantityOrdered: true, quantityReceived: true },
    });
    if (!line) {
      const message = `${match.title} is not on purchase order ${po.number}.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'rejected',
        message,
        variantId: match.variantId,
        quantity: 0,
        damagedQuantity: 0,
      });
      if (!id) return duplicateResult();
      return {
        outcome: 'rejected',
        message,
        match,
        quantity: 0,
        sessionQuantity: null,
        scanEventId: id,
      };
    }

    // The case-of-twelve rule: one trigger pull on a case code is twelve units.
    const contributed = units * match.packSize;
    const damaged = Math.min(input.damagedQuantity ?? 0, contributed);

    const scannedSoFar = await tx.$queryRaw<{ units: number }[]>`
      SELECT COALESCE(SUM(quantity), 0)::int AS units
        FROM inventory_scan_events
       WHERE tenant_id = ${ctx.tenantId}::uuid
         AND context_type = 'receipt'
         AND context_id = ${input.purchaseOrderId}::uuid
         AND variant_id = ${match.variantId}::uuid
         AND outcome = 'applied'
    `;
    const already = scannedSoFar[0]?.units ?? 0;
    const outstanding = line.quantityOrdered - line.quantityReceived - already;

    if (contributed > outstanding) {
      const message =
        outstanding <= 0
          ? `${match.title} is fully received — ${line.quantityOrdered} ordered, ${line.quantityReceived + already} accounted for.`
          : `Only ${outstanding} more of ${match.title} were ordered. This scan is ${contributed}.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'rejected',
        message,
        variantId: match.variantId,
        quantity: 0,
        damagedQuantity: 0,
      });
      if (!id) return duplicateResult();
      return {
        outcome: 'rejected',
        message,
        match,
        quantity: 0,
        sessionQuantity: already,
        scanEventId: id,
      };
    }

    const id = await recordScan(tx, ctx.tenantId, {
      ...base,
      outcome: 'applied',
      message: null,
      variantId: match.variantId,
      quantity: contributed,
      damagedQuantity: damaged,
    });
    if (!id) return duplicateResult();

    const total = already + contributed;
    return {
      outcome: 'applied',
      message:
        damaged > 0
          ? `${contributed} × ${match.title} (${damaged} damaged) — ${total} of ${line.quantityOrdered}.`
          : `${contributed} × ${match.title} — ${total} of ${line.quantityOrdered}.`,
      match,
      quantity: contributed,
      sessionQuantity: total,
      scanEventId: id,
    };
  });
}

export interface PostScannedReceiptInput {
  purchaseOrderId: string;
  reference?: string;
  note?: string;
  /** Which shelf the good units go on when the scans did not say. */
  binId?: string | null;
}

/**
 * Turn a finished scanning session into a goods receipt.
 *
 * Goes through `createGoodsReceipt` rather than writing movements itself, so a
 * scanned delivery and a typed one produce byte-identical ledger entries,
 * lot handling, PO advancement and events. The scan session is an INPUT METHOD;
 * it is not a second way to receive stock.
 *
 * On success the session's scan events are re-pointed from the purchase order to
 * the receipt. That both empties the session (so a second post has nothing to
 * post) and keeps the provenance: the receipt can say which gun booked it.
 */
export async function postScannedReceipt(
  ctx: ServiceContext,
  input: PostScannedReceiptInput
): Promise<GoodsReceiptDetail> {
  const session = await receivingSession(ctx, input.purchaseOrderId);
  const lines = session.lines.filter((l) => l.scanned > 0);
  if (lines.length === 0) {
    throw new InventoryValidationError('Nothing has been scanned into this delivery yet.');
  }

  const receipt = await createGoodsReceipt(ctx, {
    purchaseOrderId: input.purchaseOrderId,
    ...(input.reference !== undefined ? { reference: input.reference } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    lines: lines.map((l) => ({
      purchaseOrderLineId: l.purchaseOrderLineId,
      // `scanned` counts everything that arrived; the damaged share is booked
      // separately by the receipt, never as sellable stock.
      quantity: l.scanned - l.scannedDamaged,
      ...(l.scannedDamaged > 0 ? { quantityDamaged: l.scannedDamaged } : {}),
      ...(input.binId ? { binId: input.binId } : {}),
    })),
  });

  await withTenant(ctx, async (tx) => {
    await tx.$executeRaw`
      UPDATE inventory_scan_events
         SET context_id = ${receipt.id}::uuid
       WHERE tenant_id = ${ctx.tenantId}::uuid
         AND context_type = 'receipt'
         AND context_id = ${input.purchaseOrderId}::uuid
    `;
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.goods_receipt.posted_from_scans',
      entityType: 'GoodsReceipt',
      entityId: receipt.id,
      diff: { after: { purchaseOrderId: input.purchaseOrderId, lineCount: lines.length } },
    });
  });

  return receipt;
}

/** Undo one scan in an open receiving session. Deletes rather than negates —
 *  nothing has reached the ledger yet, so there is no history to preserve, and a
 *  session littered with correction rows is harder to read than one that is
 *  simply right. */
export async function undoReceivingScan(
  ctx: ServiceContext,
  purchaseOrderId: string,
  scanEventId: string
): Promise<ReceivingSession> {
  await withTenant(ctx, async (tx) => {
    const deleted = await tx.$executeRaw`
      DELETE FROM inventory_scan_events
       WHERE tenant_id = ${ctx.tenantId}::uuid
         AND id = ${scanEventId}::uuid
         AND context_type = 'receipt'
         AND context_id = ${purchaseOrderId}::uuid
    `;
    if (deleted === 0) throw new InventoryNotFoundError('InventoryScanEvent', scanEventId);
  });
  return receivingSession(ctx, purchaseOrderId);
}

// ─── 3.6 Scan to count ─────────────────────────────────────────────────────────

export interface ScanToCountInput extends ScanEnvelope {
  countId: string;
  /**
   * Add the scanned units to the running total (the default, and what a person
   * walking a shelf means) rather than replacing it. Set false for a keypad
   * entry where the operator typed the whole number.
   */
  accumulate?: boolean;
}

/**
 * One trigger pull into an open count.
 *
 * Two behaviours worth stating, because both differ from the typed-entry path:
 *
 *   • Scanning ACCUMULATES. Ten pulls on the same item is ten, which is what
 *     counting a shelf physically is. Setting a total is the keypad's job.
 *   • An item not on the sheet is ADDED to it, not refused. Finding stock that
 *     the system does not think exists is the single most valuable thing a count
 *     does, and a workflow that rejects it teaches people to leave it off.
 */
export async function scanToCount(
  ctx: ServiceContext,
  input: ScanToCountInput
): Promise<ScanActionResult> {
  const { units, when, device } = envelopeDefaults(input);
  const resolution = await resolveScan(ctx, input.value, { expect: ['variant'] });
  const match = resolution.matches.find((m): m is VariantScanMatch => m.kind === 'variant') ?? null;

  return withTenant(ctx, async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: input.countId, tenantId: ctx.tenantId },
      select: { id: true, number: true, status: true, warehouseId: true, binId: true },
    });
    if (!count) throw new InventoryNotFoundError('InventoryCount', input.countId);
    if (count.status !== 'counting') {
      throw new InventoryConflictError(
        `Count ${count.number} is ${count.status} and is no longer being counted.`,
        'status'
      );
    }

    const base = {
      idempotencyKey: input.idempotencyKey,
      value: input.value,
      contextType: 'count' as const,
      contextId: input.countId,
      deviceId: device,
      scannedAt: when,
      actorId: ctx.userId ?? null,
      binId: count.binId,
      damagedQuantity: 0,
    };

    if (!match) {
      const message = `Nothing in the catalogue matches ${resolution.scanned}.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'not_found',
        message,
        variantId: null,
        quantity: 0,
      });
      if (!id) return duplicateResult();
      return {
        outcome: 'not_found',
        message,
        match: null,
        quantity: 0,
        sessionQuantity: null,
        scanEventId: id,
      };
    }

    const contributed = units * match.packSize;
    const id = await recordScan(tx, ctx.tenantId, {
      ...base,
      outcome: 'applied',
      message: null,
      variantId: match.variantId,
      quantity: contributed,
    });
    if (!id) return duplicateResult();

    // Find the line, or make one. A variant absent from the sheet is stock the
    // system does not know about, and its expected quantity is whatever the
    // level says right now — which for genuinely unknown stock is zero, and the
    // variance the count is FOR.
    let line = await tx.inventoryCountLine.findFirst({
      where: { countId: count.id, variantId: match.variantId },
      select: { id: true, countedQuantity: true },
    });
    if (!line) {
      const level = await tx.inventoryLevel.findUnique({
        where: {
          variantId_warehouseId: { variantId: match.variantId, warehouseId: count.warehouseId },
        },
        select: { onHand: true },
      });
      const created = await tx.inventoryCountLine.create({
        data: {
          tenantId: ctx.tenantId,
          countId: count.id,
          variantId: match.variantId,
          expectedQuantity: level?.onHand ?? 0,
          ...(count.binId ? { binId: count.binId } : {}),
        },
        select: { id: true, countedQuantity: true },
      });
      line = created;
    }

    const accumulate = input.accumulate ?? true;
    const total = accumulate ? (line.countedQuantity ?? 0) + contributed : contributed;
    await tx.inventoryCountLine.update({
      where: { id: line.id },
      data: { countedQuantity: total },
    });

    return {
      outcome: 'applied',
      message: `${match.title} — ${total} counted.`,
      match,
      quantity: contributed,
      sessionQuantity: total,
      scanEventId: id,
    };
  });
}

/** The count after a scan, in the same shape every other count read returns. */
export async function scanToCountAndReload(
  ctx: ServiceContext,
  input: ScanToCountInput
): Promise<{ scan: ScanActionResult; count: InventoryCountDetail }> {
  const scan = await scanToCount(ctx, input);
  return { scan, count: await getInventoryCount(ctx, input.countId) };
}

// ─── 3.7 Scan to transfer, and scan to put away ────────────────────────────────

export interface ScanToTransferInput extends ScanEnvelope {
  transferId: string;
}

/**
 * One trigger pull into a draft transfer.
 *
 * Only draft transfers accept scans: once a transfer is in transit its contents
 * are a claim about a box already on a truck, and editing that from a scanner in
 * the origin warehouse would describe something that is not true anywhere.
 */
export async function scanToTransfer(
  ctx: ServiceContext,
  input: ScanToTransferInput
): Promise<ScanActionResult> {
  const { units, when, device } = envelopeDefaults(input);
  const resolution = await resolveScan(ctx, input.value, { expect: ['variant'] });
  const match = resolution.matches.find((m): m is VariantScanMatch => m.kind === 'variant') ?? null;

  return withTenant(ctx, async (tx) => {
    const transfer = await tx.inventoryTransfer.findFirst({
      where: { id: input.transferId, tenantId: ctx.tenantId },
      select: { id: true, number: true, status: true, fromWarehouseId: true },
    });
    if (!transfer) throw new InventoryNotFoundError('InventoryTransfer', input.transferId);
    if (transfer.status !== 'draft') {
      throw new InventoryConflictError(
        `Transfer ${transfer.number} is ${transfer.status} and can no longer be added to.`,
        'status'
      );
    }

    const base = {
      idempotencyKey: input.idempotencyKey,
      value: input.value,
      contextType: 'transfer' as const,
      contextId: input.transferId,
      deviceId: device,
      scannedAt: when,
      actorId: ctx.userId ?? null,
      binId: null,
      damagedQuantity: 0,
    };

    if (!match) {
      const message = `Nothing in the catalogue matches ${resolution.scanned}.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'not_found',
        message,
        variantId: null,
        quantity: 0,
      });
      if (!id) return duplicateResult();
      return {
        outcome: 'not_found',
        message,
        match: null,
        quantity: 0,
        sessionQuantity: null,
        scanEventId: id,
      };
    }

    const contributed = units * match.packSize;
    const id = await recordScan(tx, ctx.tenantId, {
      ...base,
      outcome: 'applied',
      message: null,
      variantId: match.variantId,
      quantity: contributed,
    });
    if (!id) return duplicateResult();

    const existing = await tx.inventoryTransferLine.findFirst({
      where: { transferId: transfer.id, variantId: match.variantId },
      select: { id: true, quantity: true },
    });
    const total = (existing?.quantity ?? 0) + contributed;
    if (existing) {
      await tx.inventoryTransferLine.update({
        where: { id: existing.id },
        data: { quantity: total },
      });
    } else {
      await tx.inventoryTransferLine.create({
        data: {
          tenantId: ctx.tenantId,
          transferId: transfer.id,
          variantId: match.variantId,
          quantity: contributed,
        },
      });
    }

    return {
      outcome: 'applied',
      message: `${match.title} — ${total} on the transfer.`,
      match,
      quantity: contributed,
      sessionQuantity: total,
      scanEventId: id,
    };
  });
}

export interface ScanPutAwayInput extends ScanEnvelope {
  warehouseId: string;
  /**
   * The shelf it came off. Omitted, the location's `receiving` shelf is used and
   * the DEFAULT shelf after that — because the overwhelmingly common put-away is
   * "off the dock, onto the rack", and making someone scan the dock first to say
   * so is a trigger pull that carries no information.
   */
  fromBinId?: string | null;
  /** The shelf it is going on. Scanned second, after the item. */
  toBinId: string;
}

/** Where a put-away comes FROM when nobody said: the receiving shelf, else DEFAULT. */
async function originBinFor(tx: TxClient, tenantId: string, warehouseId: string): Promise<string> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM inventory_bins
     WHERE tenant_id = ${tenantId}::uuid
       AND warehouse_id = ${warehouseId}::uuid
       AND is_active = true AND deleted_at IS NULL
       AND (type = 'receiving' OR is_default = true)
     ORDER BY (type = 'receiving') DESC
     LIMIT 1
  `;
  const id = rows[0]?.id;
  if (!id) {
    throw new InventoryValidationError(
      'This location has no shelves set up yet, so there is nowhere to put things away from.'
    );
  }
  return id;
}

/**
 * Scan an item, scan a shelf, and the stock is on that shelf.
 *
 * Delegates to `moveBetweenBins` so a scanned put-away and a typed one write the
 * same bin-ledger pair. The scan event is recorded FIRST and separately: if the
 * move then fails, the record that somebody tried is still there, which is the
 * only way anyone reconstructs what happened on a bad morning.
 */
export async function scanPutAway(
  ctx: ServiceContext,
  input: ScanPutAwayInput
): Promise<ScanActionResult> {
  const { units, when, device } = envelopeDefaults(input);
  const resolution = await resolveScan(ctx, input.value, {
    expect: ['variant'],
    warehouseId: input.warehouseId,
  });
  const match = resolution.matches.find((m): m is VariantScanMatch => m.kind === 'variant') ?? null;

  const base = {
    idempotencyKey: input.idempotencyKey,
    value: input.value,
    contextType: 'put_away' as const,
    contextId: input.toBinId,
    deviceId: device,
    scannedAt: when,
    actorId: ctx.userId ?? null,
    binId: input.toBinId,
    damagedQuantity: 0,
  };

  const recorded = await withTenant(ctx, async (tx) => {
    if (!match) {
      const message = `Nothing in the catalogue matches ${resolution.scanned}.`;
      const id = await recordScan(tx, ctx.tenantId, {
        ...base,
        outcome: 'not_found',
        message,
        variantId: null,
        quantity: 0,
      });
      return { id, message, applied: false as const };
    }
    const id = await recordScan(tx, ctx.tenantId, {
      ...base,
      outcome: 'applied',
      message: null,
      variantId: match.variantId,
      quantity: units * match.packSize,
    });
    return { id, message: null, applied: true as const };
  });

  if (!recorded.id) return duplicateResult();
  if (!recorded.applied || !match) {
    return {
      outcome: 'not_found',
      message: recorded.message ?? 'Unknown code.',
      match: null,
      quantity: 0,
      sessionQuantity: null,
      scanEventId: recorded.id,
    };
  }

  const contributed = units * match.packSize;
  const fromBinId =
    input.fromBinId ??
    (await withTenant(ctx, (tx) => originBinFor(tx, ctx.tenantId, input.warehouseId)));

  await moveBetweenBins(ctx, {
    variantId: match.variantId,
    fromBinId,
    toBinId: input.toBinId,
    quantity: contributed,
    // Keyed off the scan, so a replayed put-away moves the stock once. The two
    // halves of the bin move suffix this themselves.
    idempotencyKey: `scan:${input.idempotencyKey}`,
  });

  return {
    outcome: 'applied',
    message: `${contributed} × ${match.title} put away.`,
    match,
    quantity: contributed,
    sessionQuantity: null,
    scanEventId: recorded.id,
  };
}

// ─── 3.9 The offline queue ─────────────────────────────────────────────────────

export interface QueuedScan extends ScanEnvelope {
  /** Which workflow this scan belongs to — the client queues them mixed. */
  contextType: Exclude<ScanContextType, 'pick'>;
  contextId: string;
  /** Put-away only. */
  warehouseId?: string;
  toBinId?: string;
  fromBinId?: string | null;
  binId?: string | null;
}

export interface ReplayResult {
  idempotencyKey: string;
  outcome: ScanOutcome | 'error';
  message: string;
}

/**
 * Replay a queue of scans captured while the connection was down.
 *
 * Each is applied through its ordinary workflow, in the order the trigger was
 * pulled, and each is independently idempotent — so a replay that itself fails
 * halfway can simply be retried whole. Failures do NOT stop the batch: one
 * unresolvable code in a queue of two hundred should cost that one scan, not the
 * morning's work.
 */
export async function replayScanQueue(
  ctx: ServiceContext,
  scans: QueuedScan[]
): Promise<ReplayResult[]> {
  const ordered = [...scans].sort((a, b) => (a.scannedAt ?? '').localeCompare(b.scannedAt ?? ''));
  const results: ReplayResult[] = [];

  for (const scan of ordered) {
    try {
      let result: ScanActionResult;
      switch (scan.contextType) {
        case 'receipt':
          result = await scanToReceive(ctx, { ...scan, purchaseOrderId: scan.contextId });
          break;
        case 'count':
          result = await scanToCount(ctx, { ...scan, countId: scan.contextId });
          break;
        case 'transfer':
          result = await scanToTransfer(ctx, { ...scan, transferId: scan.contextId });
          break;
        case 'put_away':
          if (!scan.warehouseId || !scan.toBinId) {
            throw new InventoryValidationError('A queued put-away needs a location and a shelf.');
          }
          result = await scanPutAway(ctx, {
            ...scan,
            warehouseId: scan.warehouseId,
            toBinId: scan.toBinId,
            fromBinId: scan.fromBinId ?? null,
          });
          break;
        case 'lookup':
          // A lookup changed nothing at the time and changes nothing now. It is
          // replayed only so the record of what the floor was doing is complete.
          result = await recordLookupScan(ctx, scan);
          break;
      }
      results.push({
        idempotencyKey: scan.idempotencyKey,
        outcome: result.outcome,
        message: result.message,
      });
    } catch (err) {
      results.push({
        idempotencyKey: scan.idempotencyKey,
        outcome: 'error',
        message: err instanceof Error ? err.message : 'That scan could not be replayed.',
      });
    }
  }

  return results;
}

/** A scan that only asked a question. Recorded so the floor's activity is whole. */
async function recordLookupScan(ctx: ServiceContext, scan: QueuedScan): Promise<ScanActionResult> {
  const { units, when, device } = envelopeDefaults(scan);
  const resolution = await resolveScan(ctx, scan.value);
  const match = resolution.matches.find((m): m is VariantScanMatch => m.kind === 'variant') ?? null;

  return withTenant(ctx, async (tx) => {
    const id = await recordScan(tx, ctx.tenantId, {
      idempotencyKey: scan.idempotencyKey,
      value: scan.value,
      contextType: 'lookup',
      contextId: null,
      outcome: match ? 'applied' : 'not_found',
      message: match ? null : `Nothing matches ${resolution.scanned}.`,
      variantId: match?.variantId ?? null,
      binId: null,
      quantity: match ? units * match.packSize : 0,
      damagedQuantity: 0,
      deviceId: device,
      scannedAt: when,
      actorId: ctx.userId ?? null,
    });
    if (!id) return duplicateResult();
    return {
      outcome: match ? ('applied' as const) : ('not_found' as const),
      message: match ? match.title : `Nothing matches ${resolution.scanned}.`,
      match,
      quantity: match ? units * match.packSize : 0,
      sessionQuantity: null,
      scanEventId: id,
    };
  });
}

// ─── Scan history ──────────────────────────────────────────────────────────────

export interface ScanEventRow {
  id: string;
  value: string;
  contextType: string;
  contextId: string | null;
  outcome: string;
  message: string | null;
  variantId: string | null;
  sku: string | null;
  productTitle: string | null;
  binId: string | null;
  binCode: string | null;
  quantity: number;
  damagedQuantity: number;
  deviceId: string | null;
  actorId: string | null;
  scannedAt: string;
  createdAt: string;
  /**
   * Seconds between the trigger pull and us hearing about it. Zero on a live
   * scan; on a replayed one this IS the outage, and it is the number that
   * explains why a count entered at 09:14 describes a shelf as it was at 06:02.
   */
  replayLagSeconds: number;
}

export interface ListScanEventsFilter {
  contextType?: ScanContextType;
  contextId?: string;
  variantId?: string;
  outcome?: ScanOutcome;
  deviceId?: string;
  take?: number;
  skip?: number;
}

export async function listScanEvents(
  ctx: ServiceContext,
  filter: ListScanEventsFilter = {}
): Promise<{ items: ScanEventRow[]; total: number }> {
  const take = Math.min(filter.take ?? 100, 500);
  const skip = filter.skip ?? 0;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<
      (Omit<ScanEventRow, 'scannedAt' | 'createdAt'> & { scannedAt: Date; createdAt: Date })[]
    >`
      SELECT se.id            AS "id",
             se.value         AS "value",
             se.context_type  AS "contextType",
             se.context_id    AS "contextId",
             se.outcome       AS "outcome",
             se.message       AS "message",
             se.variant_id    AS "variantId",
             v.sku            AS "sku",
             p.title          AS "productTitle",
             se.bin_id        AS "binId",
             b.code           AS "binCode",
             se.quantity      AS "quantity",
             se.damaged_quantity AS "damagedQuantity",
             se.device_id     AS "deviceId",
             se.actor_id      AS "actorId",
             se.scanned_at    AS "scannedAt",
             se.created_at    AS "createdAt",
             GREATEST(0, EXTRACT(EPOCH FROM (se.created_at - se.scanned_at)))::int
                              AS "replayLagSeconds"
        FROM inventory_scan_events se
        LEFT JOIN commerce_product_variants v ON v.id = se.variant_id
        LEFT JOIN commerce_products p         ON p.id = v.product_id
        LEFT JOIN inventory_bins b            ON b.id = se.bin_id
       WHERE se.tenant_id = ${ctx.tenantId}::uuid
         AND (${filter.contextType ?? null}::text IS NULL OR se.context_type = ${filter.contextType ?? null})
         AND (${filter.contextId ?? null}::uuid IS NULL OR se.context_id = ${filter.contextId ?? null}::uuid)
         AND (${filter.variantId ?? null}::uuid IS NULL OR se.variant_id = ${filter.variantId ?? null}::uuid)
         AND (${filter.outcome ?? null}::text IS NULL OR se.outcome = ${filter.outcome ?? null})
         AND (${filter.deviceId ?? null}::text IS NULL OR se.device_id = ${filter.deviceId ?? null})
       ORDER BY se.scanned_at DESC
       LIMIT ${take} OFFSET ${skip}
    `;

    const totals = await tx.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
        FROM inventory_scan_events se
       WHERE se.tenant_id = ${ctx.tenantId}::uuid
         AND (${filter.contextType ?? null}::text IS NULL OR se.context_type = ${filter.contextType ?? null})
         AND (${filter.contextId ?? null}::uuid IS NULL OR se.context_id = ${filter.contextId ?? null}::uuid)
         AND (${filter.variantId ?? null}::uuid IS NULL OR se.variant_id = ${filter.variantId ?? null}::uuid)
         AND (${filter.outcome ?? null}::text IS NULL OR se.outcome = ${filter.outcome ?? null})
         AND (${filter.deviceId ?? null}::text IS NULL OR se.device_id = ${filter.deviceId ?? null})
    `;

    return {
      items: rows.map((r) => ({
        ...r,
        scannedAt: r.scannedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      total: totals[0]?.total ?? 0,
    };
  });
}
