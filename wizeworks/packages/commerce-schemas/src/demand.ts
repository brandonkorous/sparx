// Demand-side commitments (docs/146 Phase 9).
//
// The write schemas for backorders, preorder windows, the stock-ownership axis,
// consignment settlement and returns disposition — plus the PURE arithmetic that
// decides a promised date, who gets a delivery, whether a preorder is open, and
// how close a lot is to expiring.
//
// The arithmetic lives here for the reason Phase 7's and Phase 8's does: the
// nightly sweep, the API, the storefront and the workbench must not arrive at
// four different answers. But this phase has a sharper version of the problem,
// because its outputs are read by CUSTOMERS. A backorder screen that says "18
// March" and a confirmation email that says "25 March" is not an inconsistency
// bug, it is a business calling itself unreliable in writing.
//
// ── The rule ─────────────────────────────────────────────────────────────────
//
//   A PROMISED DATE IS NULL UNTIL SOMETHING ACTUALLY PROMISED IT, AND THE
//   RESULT CARRIES WHICH.
//
// Every function below that could return a date returns `null` rather than a
// plausible one, and every date it does return arrives with its provenance
// attached. `resolvePromisedDate` will not fall back to "two weeks" because two
// weeks is the sort of number that sounds like knowledge.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

// The disposition vocabulary itself lives with the rest of the stock words in
// ./inventory, where it was declared (unused) in Phase 2. Phase 9 gives it a
// column, a behaviour table and an input schema — but not a second definition.
import { ReturnDisposition } from './inventory';

// ─── 9.1 Backorders ──────────────────────────────────────────────────────────

export const BackorderStatus = z.enum(['open', 'partial', 'allocated', 'fulfilled', 'cancelled']);
export type BackorderStatus = z.infer<typeof BackorderStatus>;

export const BackorderHolderType = z.enum(['order', 'subscription']);
export type BackorderHolderType = z.infer<typeof BackorderHolderType>;

/**
 * Where a promised date came from, and therefore what it is worth.
 *
 * Ordered by strength, and the order is load-bearing — `resolvePromisedDate`
 * prefers the earlier one and the UI grades its confidence by this field:
 *
 *   purchase_order  a real order exists and the supplier stated an arrival date
 *   lead_time       a MEASURED lead time applied to a date. A forecast.
 *   manual          a person typed it, which beats both when they know something
 *                   the system does not, and is worth nothing when they guessed.
 */
export const PromiseSource = z.enum(['purchase_order', 'lead_time', 'manual']);
export type PromiseSource = z.infer<typeof PromiseSource>;

export const BackorderAllocationSource = z.enum(['goods_receipt', 'transfer', 'count', 'manual']);
export type BackorderAllocationSource = z.infer<typeof BackorderAllocationSource>;

export const UpdateBackorderInput = z.object({
  /** Higher goes first. Bumping somebody up the queue is a decision a person
   *  makes about a relationship, so it is editable and it is recorded. */
  priority: z.number().int().min(-1000).max(1000).optional(),
  /** Explicit null CLEARS the promise — which is a real thing to want when a
   *  date turns out to be wrong. Clearing is honest; leaving a date everyone
   *  knows is dead on the screen is not. */
  promisedAt: z.string().datetime().nullable().optional(),
  expectedPurchaseOrderId: Uuid.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type UpdateBackorderInput = z.infer<typeof UpdateBackorderInput>;

export const CancelBackorderInput = z.object({
  reason: z.string().min(1).max(500),
});
export type CancelBackorderInput = z.infer<typeof CancelBackorderInput>;

export const ListBackordersFilter = z.object({
  status: BackorderStatus.optional(),
  variantId: Uuid.optional(),
  warehouseId: Uuid.optional(),
  customerId: Uuid.optional(),
  /** Only rows nobody has been able to promise a date for — the work list. */
  undatedOnly: z.boolean().optional(),
  /** Only rows whose promised date has already gone by without being filled. */
  overdueOnly: z.boolean().optional(),
  take: z.number().int().min(1).max(200).optional(),
  skip: z.number().int().min(0).optional(),
});
export type ListBackordersFilter = z.infer<typeof ListBackordersFilter>;

// ─── The promise ─────────────────────────────────────────────────────────────

export interface PromiseInputs {
  /** The expected arrival on a purchase order that covers this item, when one
   *  exists AND carries a date. */
  purchaseOrderArrivalAt?: Date | null;
  /** A lead time MEASURED from this supplier's deliveries — never a configured
   *  default, never a guess. Null when nothing has been measured. */
  measuredLeadTimeDays?: number | null;
  /** What a measured lead time is counted FROM. Normally "now"; a backorder
   *  being re-promised counts from the day the replenishment is expected to be
   *  ordered, not from the day the customer ordered. */
  leadTimeFrom?: Date | null;
  /** A date somebody typed. Beats everything when present, because a person who
   *  has just got off the phone to the supplier knows more than the ledger. */
  manualAt?: Date | null;
}

export interface ResolvedPromise {
  promisedAt: Date | null;
  source: PromiseSource | null;
}

/**
 * The date to tell the customer, and where it came from — or null, honestly.
 *
 * Precedence is manual → purchase order → measured lead time, and the tail of
 * that list is where the discipline lives. There is no fourth branch. A
 * configured "default lead time" is NOT consulted, because a default is a
 * number a merchant typed into a settings screen once, and applying it to a
 * customer-facing promise turns a placeholder into a commitment.
 *
 * Returning `{ promisedAt: null, source: null }` is a legitimate, common and
 * useful answer: it puts the row on the "nobody can promise this" work list,
 * which is a screen a buyer can act on. A fabricated date puts it nowhere and
 * breaks a promise six weeks later.
 */
export function resolvePromisedDate(inputs: PromiseInputs): ResolvedPromise {
  if (inputs.manualAt) return { promisedAt: inputs.manualAt, source: 'manual' };
  if (inputs.purchaseOrderArrivalAt) {
    return { promisedAt: inputs.purchaseOrderArrivalAt, source: 'purchase_order' };
  }
  const days = inputs.measuredLeadTimeDays;
  const from = inputs.leadTimeFrom;
  // Both halves required. A measured lead time with nothing to count from is not
  // a date, and `Date.now()` quietly substituted here is exactly the invention
  // this function exists to refuse.
  if (days != null && days > 0 && from) {
    const at = new Date(from.getTime());
    at.setUTCDate(at.getUTCDate() + Math.ceil(days));
    return { promisedAt: at, source: 'lead_time' };
  }
  return { promisedAt: null, source: null };
}

/**
 * Whether a promise has SLIPPED far enough from what the customer was last told
 * to be worth telling them again.
 *
 * A day either way is scheduling noise and emailing about it trains people to
 * ignore you. The threshold is deliberately asymmetric-free — earlier is as
 * notable as later, because somebody who planned around a date wants to know it
 * moved in either direction.
 */
export const PROMISE_SLIP_NOTIFY_DAYS = 3;

export function promiseSlipDays(notifiedPromisedAt: Date | null, promisedAt: Date | null): number {
  if (!notifiedPromisedAt || !promisedAt) return 0;
  const ms = promisedAt.getTime() - notifiedPromisedAt.getTime();
  return Math.round(ms / 86_400_000);
}

export function shouldRenotify(
  notifiedPromisedAt: Date | null,
  promisedAt: Date | null,
  thresholdDays: number = PROMISE_SLIP_NOTIFY_DAYS
): boolean {
  // Never told them anything yet, but we have a date now — that is the FIRST
  // notification, and it is always worth sending.
  if (!notifiedPromisedAt) return promisedAt != null;
  if (!promisedAt) return false;
  return Math.abs(promiseSlipDays(notifiedPromisedAt, promisedAt)) >= thresholdDays;
}

// ─── 9.2 Filling the queue ───────────────────────────────────────────────────

export interface QueuedCommitment {
  id: string;
  /** Units still owed on this commitment (`quantity - allocatedQuantity`). */
  outstanding: number;
}

export interface QueueFill {
  id: string;
  quantity: number;
}

export interface QueueFillResult {
  fills: QueueFill[];
  /** Units left over after everyone in the queue was satisfied — free stock. */
  remaining: number;
  /** Units still owed across the whole queue after this arrival. */
  stillOwed: number;
}

/**
 * Share an arrival out across the queue, IN ORDER, first come first served.
 *
 * ── Why not pro-rata ──
 *
 * Splitting 40 units across four customers who each want 40 is the intuitive
 * "fair" answer and it is the wrong one: it produces four customers who cannot
 * be shipped instead of one who can. Partial fills are only useful where a
 * partial shipment is useful, and for most businesses it is not. Strict queue
 * order also has the property that being first in line MEANS something, which is
 * what a customer thinks a backorder is.
 *
 * The last commitment reached may still be filled partially — the arrival simply
 * ran out mid-way through it — and that is a genuine partial, not a policy.
 *
 * The caller passes the queue already ordered (priority desc, then age). This
 * function does not sort: the ordering is a business decision made in SQL where
 * the index lives, and re-deciding it here is how two answers appear.
 */
export function fillQueue(
  unitsAvailable: number,
  queue: readonly QueuedCommitment[]
): QueueFillResult {
  let remaining = Math.max(0, Math.floor(unitsAvailable));
  const fills: QueueFill[] = [];
  let stillOwed = 0;

  for (const item of queue) {
    const owed = Math.max(0, Math.floor(item.outstanding));
    if (owed === 0) continue;
    if (remaining === 0) {
      stillOwed += owed;
      continue;
    }
    const give = Math.min(owed, remaining);
    fills.push({ id: item.id, quantity: give });
    remaining -= give;
    stillOwed += owed - give;
  }

  return { fills, remaining, stillOwed };
}

/** The status a commitment lands in once `allocated` of `quantity` are covered. */
export function backorderStatusFor(quantity: number, allocated: number): BackorderStatus {
  if (allocated <= 0) return 'open';
  if (allocated >= quantity) return 'allocated';
  return 'partial';
}

// ─── 9.4 Preorder windows ────────────────────────────────────────────────────

export const PreorderWindowStatus = z.enum(['scheduled', 'open', 'closed', 'cancelled']);
export type PreorderWindowStatus = z.infer<typeof PreorderWindowStatus>;

export const UpsertPreorderWindowInput = z
  .object({
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    /** The date the customer is told. Nullable on purpose — see the schema. */
    availableAt: z.string().datetime().nullable().optional(),
    availabilityNote: z.string().max(255).nullable().optional(),
    isCapped: z.boolean().optional(),
    maxQuantity: z.number().int().min(0).max(10_000_000).optional(),
    chargeUpFront: z.boolean().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => !v.isCapped || (v.maxQuantity ?? 0) > 0, {
    message: 'A capped preorder needs a limit above zero — a cap of nothing is a closed shop.',
    path: ['maxQuantity'],
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'A preorder window has to close after it opens.',
    path: ['endsAt'],
  })
  .refine(
    // The one thing a customer must be able to rely on: if you name a date, it
    // has to be after the window they are buying in. "Available 1 June, order
    // until 30 June" is a shop taking money for something already late.
    (v) => !v.availableAt || !v.startsAt || new Date(v.availableAt) >= new Date(v.startsAt),
    {
      message: 'The availability date cannot be before the preorder opens.',
      path: ['availableAt'],
    }
  );
export type UpsertPreorderWindowInput = z.infer<typeof UpsertPreorderWindowInput>;

export interface PreorderWindowShape {
  status: PreorderWindowStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  isCapped: boolean;
  maxQuantity: number;
  soldQuantity: number;
}

export interface PreorderState {
  /** Whether a customer may commit right now. */
  isTakingOrders: boolean;
  /** The status the DATES imply, which may differ from the stored column until
   *  the sweep reconciles it. The dates win. */
  effectiveStatus: PreorderWindowStatus;
  /** Units still sellable on preorder, or null when uncapped.
   *
   *  Null means UNLIMITED, and a storefront must render it as nothing at all
   *  rather than as a number. There is no honest integer for "no limit", and
   *  every value that gets used as one (0, -1, 999999) shows up on a page one
   *  day as "999999 left". */
  remaining: number | null;
  /** Why it is not taking orders, when it is not. */
  blockedBy: 'not_started' | 'ended' | 'sold_out' | 'closed' | 'cancelled' | null;
}

export function preorderState(window: PreorderWindowShape, now: Date): PreorderState {
  const remaining = window.isCapped ? Math.max(0, window.maxQuantity - window.soldQuantity) : null;

  if (window.status === 'cancelled') {
    return {
      isTakingOrders: false,
      effectiveStatus: 'cancelled',
      remaining,
      blockedBy: 'cancelled',
    };
  }
  if (window.status === 'closed') {
    return { isTakingOrders: false, effectiveStatus: 'closed', remaining, blockedBy: 'closed' };
  }
  if (window.startsAt && now < window.startsAt) {
    return {
      isTakingOrders: false,
      effectiveStatus: 'scheduled',
      remaining,
      blockedBy: 'not_started',
    };
  }
  if (window.endsAt && now >= window.endsAt) {
    return { isTakingOrders: false, effectiveStatus: 'closed', remaining, blockedBy: 'ended' };
  }
  if (remaining !== null && remaining <= 0) {
    return { isTakingOrders: false, effectiveStatus: 'open', remaining: 0, blockedBy: 'sold_out' };
  }
  return { isTakingOrders: true, effectiveStatus: 'open', remaining, blockedBy: null };
}

// ─── 9.5 The ownership axis ──────────────────────────────────────────────────

export const StockOwnership = z.enum(['owned', 'consignment', 'customer_owned', '3pl_owned']);
export type StockOwnership = z.infer<typeof StockOwnership>;

export const SetStockOwnershipInput = z
  .object({
    variantId: Uuid,
    warehouseId: Uuid,
    ownership: StockOwnership,
    ownerSupplierId: Uuid.nullable().optional(),
    ownerCustomerId: Uuid.nullable().optional(),
  })
  .refine((v) => v.ownership === 'owned' || !(v.ownerSupplierId && v.ownerCustomerId), {
    message: 'Stock has one owner, not two.',
    path: ['ownerSupplierId'],
  })
  .refine((v) => v.ownership !== 'owned' || (!v.ownerSupplierId && !v.ownerCustomerId), {
    message: 'Stock you own has no external owner.',
    path: ['ownership'],
  });
export type SetStockOwnershipInput = z.infer<typeof SetStockOwnershipInput>;

/**
 * Whether stock under this ownership belongs on YOUR balance sheet.
 *
 * The single behavioural consequence of the whole axis. Consigned and
 * customer-owned goods are somebody else's asset sitting in your building; 3PL
 * stock in this sense is stock the 3PL owns, not stock they merely hold for you
 * (a warehouse of type `3pl` full of `owned` levels is still entirely yours, and
 * that is the common case).
 */
export function countsTowardValuation(ownership: string | null): boolean {
  return ownership === 'owned' || ownership === null;
}

/**
 * Whether stock under this ownership may be SOLD.
 *
 * Always true, and it is a function rather than a constant so that the asymmetry
 * is written down where somebody will find it: holding consigned stock is
 * pointless if you cannot sell it, and the entire feature is "sellable but not
 * yours". Anyone reaching for ownership to hide stock from a storefront wants
 * `unsellableOnHand` and a non-sellable shelf instead.
 */
export function countsTowardAvailability(_ownership: string | null): boolean {
  return true;
}

// ─── 9.6 Consignment settlement ──────────────────────────────────────────────

export const ConsignmentSettlementStatus = z.enum([
  'draft',
  'closed',
  'invoiced',
  'paid',
  'cancelled',
]);
export type ConsignmentSettlementStatus = z.infer<typeof ConsignmentSettlementStatus>;

export const CreateConsignmentSettlementInput = z
  .object({
    ownerType: z.enum(['supplier', 'customer']),
    supplierId: Uuid.optional(),
    customerId: Uuid.optional(),
    /** Half-open `[periodStart, periodEnd)`. */
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    note: z.string().max(2000).optional(),
  })
  .refine((v) => new Date(v.periodEnd) > new Date(v.periodStart), {
    message: 'A settlement period has to end after it starts.',
    path: ['periodEnd'],
  })
  .refine(
    (v) =>
      (v.ownerType === 'supplier' && !!v.supplierId && !v.customerId) ||
      (v.ownerType === 'customer' && !!v.customerId && !v.supplierId),
    { message: 'A settlement names exactly one counterparty.', path: ['ownerType'] }
  );
export type CreateConsignmentSettlementInput = z.infer<typeof CreateConsignmentSettlementInput>;

export interface ConsignedSale {
  variantId: string;
  warehouseId: string;
  units: number;
  /** The cost recorded ON THE MOVEMENT — what the goods cost when they sold, not
   *  what an average says today. */
  unitCostCents: number;
  movementId: string;
}

export interface SettlementLineDraft {
  variantId: string;
  warehouseId: string;
  unitsSold: number;
  unitCostCents: number;
  amountCents: number;
  movementIds: string[];
}

export interface SettlementDraft {
  lines: SettlementLineDraft[];
  totalCents: number;
  unitsSold: number;
  /** Sales that could not be priced, because no cost was recorded on the
   *  movement. Reported, NEVER valued at zero — a consignment line worth $0.00
   *  reads as "they gave it to us", which is the most expensive possible way to
   *  be wrong about money owed. */
  unpricedUnits: number;
  unpricedMovementIds: string[];
}

/**
 * Roll a period's consigned sales into settlement lines.
 *
 * Grouped by (variant, location, unit cost): the same item consigned at two
 * different agreed costs is two lines, because collapsing them to a weighted
 * average produces a total that is right and a line the supplier cannot check
 * against their own paperwork. A settlement that cannot be checked gets
 * disputed.
 */
export function draftSettlement(sales: readonly ConsignedSale[]): SettlementDraft {
  const byKey = new Map<string, SettlementLineDraft>();
  let unpricedUnits = 0;
  const unpricedMovementIds: string[] = [];

  for (const sale of sales) {
    const units = Math.abs(Math.floor(sale.units));
    if (units === 0) continue;

    if (!Number.isFinite(sale.unitCostCents) || sale.unitCostCents <= 0) {
      unpricedUnits += units;
      unpricedMovementIds.push(sale.movementId);
      continue;
    }

    const key = `${sale.variantId}:${sale.warehouseId}:${sale.unitCostCents}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.unitsSold += units;
      existing.amountCents += units * sale.unitCostCents;
      existing.movementIds.push(sale.movementId);
    } else {
      byKey.set(key, {
        variantId: sale.variantId,
        warehouseId: sale.warehouseId,
        unitsSold: units,
        unitCostCents: sale.unitCostCents,
        amountCents: units * sale.unitCostCents,
        movementIds: [sale.movementId],
      });
    }
  }

  const lines = [...byKey.values()];
  return {
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.amountCents, 0),
    unitsSold: lines.reduce((sum, l) => sum + l.unitsSold, 0),
    unpricedUnits,
    unpricedMovementIds,
  };
}

// ─── 9.7 Returns disposition ─────────────────────────────────────────────────

export const SetReturnDispositionInput = z
  .object({
    inspectionId: Uuid,
    disposition: ReturnDisposition,
    /** Where it physically goes. Ignored for `scrap`, which goes nowhere. */
    binId: Uuid.nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => v.disposition !== 'scrap' || (v.note != null && v.note.trim().length > 0), {
    // Writing off a customer's returned goods is the one disposition with no
    // undo and no artefact — nothing is on a shelf afterwards to look at. The
    // reason IS the record.
    message: 'Scrapping returned goods needs a reason.',
    path: ['note'],
  });
export type SetReturnDispositionInput = z.infer<typeof SetReturnDispositionInput>;

export interface DispositionEffect {
  /** Whether the units re-enter stock at all. */
  addsStock: boolean;
  /** Whether they are sellable once they are there. */
  sellable: boolean;
  /** The system shelf they belong on, when they are not going to a named one. */
  systemBinCode: 'DEFAULT' | 'QUARANTINE' | 'REPAIR' | null;
  /** Kept in step with the legacy boolean the refund path still reads. */
  restockable: boolean;
}

/**
 * What each disposition actually DOES to stock.
 *
 * `scrap` writes no movement at all, and that is deliberate rather than an
 * omission. The unit's cost was already relieved as COGS when it sold; adding it
 * back and immediately writing it off would post two entries that cancel, churn
 * the moving average, and land the loss in the shrinkage report — which is meant
 * to measure stock that went missing from the warehouse, not goods a customer
 * returned broken. Leaving the COGS where it is IS the correct accounting, and
 * the inspection row is the record that it happened.
 */
export function dispositionEffect(disposition: ReturnDisposition): DispositionEffect {
  switch (disposition) {
    case 'restock':
      return { addsStock: true, sellable: true, systemBinCode: 'DEFAULT', restockable: true };
    case 'quarantine':
      return {
        addsStock: true,
        sellable: false,
        systemBinCode: 'QUARANTINE',
        restockable: false,
      };
    case 'repair':
      return { addsStock: true, sellable: false, systemBinCode: 'REPAIR', restockable: false };
    case 'scrap':
      return { addsStock: false, sellable: false, systemBinCode: null, restockable: false };
  }
}

// ─── 9.8 Expiry ──────────────────────────────────────────────────────────────

/** The horizons the report is cut at. Thirty/sixty/ninety is the category's
 *  convention and, more usefully, it maps onto how far ahead a business can act:
 *  30 days is a markdown, 60 is a promotion, 90 is a purchasing decision. */
export const EXPIRY_HORIZON_DAYS = [30, 60, 90] as const;

export type ExpiryBucket = 'expired' | 'd30' | 'd60' | 'd90' | 'beyond' | 'undated';

/**
 * How urgent a lot's expiry is.
 *
 * `undated` is its own bucket and is NOT folded into `beyond`. A lot with no
 * expiry date is not a lot that expires late — it is a lot nobody recorded a
 * date for, which for a business that needs to track expiry is a data-entry
 * problem worth surfacing rather than a reassuring green row.
 */
export function expiryBucket(expiresAt: Date | null, now: Date): ExpiryBucket {
  if (!expiresAt) return 'undated';
  const days = Math.floor((expiresAt.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  if (days <= 90) return 'd90';
  return 'beyond';
}

/** Whole days until expiry — negative once past. Null when undated, because
 *  "how many days until a date that does not exist" has no number. */
export function daysUntilExpiry(expiresAt: Date | null, now: Date): number | null {
  if (!expiresAt) return null;
  return Math.floor((expiresAt.getTime() - now.getTime()) / 86_400_000);
}

export const ExpiringStockAction = z.enum(['markdown', 'write_off']);
export type ExpiringStockAction = z.infer<typeof ExpiringStockAction>;

export const MarkdownExpiringLotInput = z.object({
  lotId: Uuid,
  /** Percent off the current price, 1–90. Capped below 100 on purpose: a 100%
   *  markdown is not a price, it is giving stock away, and that decision should
   *  be a deliberate zero-price entry rather than a slider hitting its end. */
  discountPercent: z.number().int().min(1).max(90),
  note: z.string().max(500).optional(),
});
export type MarkdownExpiringLotInput = z.infer<typeof MarkdownExpiringLotInput>;

export const WriteOffExpiringLotInput = z.object({
  lotId: Uuid,
  /** Defaults to everything left in the batch. */
  quantity: z.number().int().min(1).max(10_000_000).optional(),
  reason: z.string().min(1).max(500),
});
export type WriteOffExpiringLotInput = z.infer<typeof WriteOffExpiringLotInput>;
