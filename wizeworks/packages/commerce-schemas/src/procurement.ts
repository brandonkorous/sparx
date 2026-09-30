// Supplier performance and procurement discipline (docs/146 Phase 8).
//
// The write schemas for everything that surrounds a purchase order — the
// scorecard, quantity price breaks, approval rules, advance ship notices,
// returns to supplier and supplier bills — plus the PURE arithmetic that decides
// a price break, a scorecard grade and a three-way-match variance.
//
// The arithmetic lives here, not in the service, for the reason the planning
// module does: the nightly sweep, the API and the screen must not arrive at
// three different answers. A buyer who is shown "£3.60 at fifty" and then billed
// £4.10 because the PO resolved the break differently has been lied to by the
// software, and no test that exercises one path will ever notice.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

// ─── 8.4 Quantity price breaks ───────────────────────────────────────────────

export const UpsertPriceBreakInput = z.object({
  /** In base units. A break at 1 is the base price, which already has a home on
   *  the supplier link — two places to store one number is how they disagree. */
  minQuantity: z.number().int().min(2).max(10_000_000),
  /** Per base unit, in the supplier's currency. */
  unitCostCents: z.number().int().nonnegative().max(1_000_000_000),
});
export type UpsertPriceBreakInput = z.infer<typeof UpsertPriceBreakInput>;

/** Replace the whole ladder for one (supplier, variant) link in a single write.
 *  Wholesale replacement rather than per-row editing because a price list
 *  arrives as a list: patching three rows of five and leaving two stale is how a
 *  ladder ends up describing last year's terms. */
export const SetPriceBreaksInput = z.object({
  breaks: z.array(UpsertPriceBreakInput).max(20),
});
export type SetPriceBreaksInput = z.infer<typeof SetPriceBreaksInput>;

export interface PriceBreak {
  minQuantity: number;
  unitCostCents: number;
}

export interface ResolvedPurchasePrice {
  unitCostCents: number;
  /** `base` when no break applied, `break` when one did. */
  source: 'base' | 'break';
  /** The break that applied, when one did. */
  appliedAtQuantity: number | null;
  /** The next break up and what it would save PER UNIT, when there is one. This
   *  is the whole reason a buyer looks at a ladder: "eleven more units and the
   *  whole order is cheaper" is a decision, and it can only be made if the
   *  software volunteers it. Null at the top of the ladder. */
  nextBreakAtQuantity: number | null;
  nextBreakUnitCostCents: number | null;
}

/**
 * What one unit costs at this order quantity.
 *
 * A break is a FLOOR: the applicable price is the one attached to the largest
 * `minQuantity` the order clears. Breaks above the quantity are ignored, and a
 * ladder with a gap in it therefore cannot resolve to nothing.
 *
 * Note what this deliberately does NOT do: it never picks the cheapest price in
 * the ladder. A supplier is free to publish a break that is more expensive than
 * the tier below it — mis-keyed, or a genuine surcharge on a pallet quantity —
 * and silently substituting the cheaper one would quote a price the supplier
 * will not honour.
 */
export function resolvePurchasePrice(
  quantity: number,
  baseUnitCostCents: number,
  breaks: readonly PriceBreak[]
): ResolvedPurchasePrice {
  const qty = Math.max(0, Math.floor(finite(quantity)));
  const base = Math.max(0, Math.round(finite(baseUnitCostCents)));
  const ladder = [...breaks]
    .filter((b) => Number.isFinite(b.minQuantity) && Number.isFinite(b.unitCostCents))
    .sort((a, b) => a.minQuantity - b.minQuantity);

  let applied: PriceBreak | null = null;
  let next: PriceBreak | null = null;
  for (const step of ladder) {
    if (step.minQuantity <= qty) applied = step;
    else {
      next = step;
      break;
    }
  }

  return {
    unitCostCents: applied ? Math.max(0, Math.round(applied.unitCostCents)) : base,
    source: applied ? 'break' : 'base',
    appliedAtQuantity: applied?.minQuantity ?? null,
    nextBreakAtQuantity: next?.minQuantity ?? null,
    nextBreakUnitCostCents: next ? Math.max(0, Math.round(next.unitCostCents)) : null,
  };
}

// ─── 8.1 Scorecard scoring ───────────────────────────────────────────────────
//
// Five components, each 0–100, averaged over ONLY the ones that could be
// measured. The weights say what a buyer actually cares about: being shorted and
// being late are the failures that cost a sale, price drift is money, damage is
// both, and a lead time that is merely long is fine as long as it is honest —
// which the on-time component already captures.

export const SCORE_WEIGHTS = {
  onTime: 0.3,
  fill: 0.3,
  price: 0.2,
  damage: 0.2,
} as const;

/** Below this many measured components, no score is published. One component is
 *  not a scorecard, it is a single metric wearing a letter grade — and a grade
 *  is exactly the kind of output people act on without reading the detail. */
export const MIN_SCORED_COMPONENTS = 2;

/** A price variance of this or more scores zero. 10% over the agreed price is
 *  not a rounding difference on a purchase order; it is a different price. */
export const PRICE_VARIANCE_ZERO_AT_PCT = 10;

export interface ScorecardComponents {
  /** 0–1. Null when nobody ever quoted a date to be late for. */
  onTimeRate: number | null;
  /** 0–1. Null when no order has finished, so nothing can be called short. */
  fillRate: number | null;
  /** Signed percentage: +4 means they invoiced 4% above the agreed price. Null
   *  when no same-currency comparison existed. */
  priceVariancePct: number | null;
  /** 0–1. Null when nothing was received at all. */
  damageRate: number | null;
}

export interface ScorecardScore {
  score: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | null;
  scoredComponents: number;
}

/**
 * Grade a supplier on what is actually known about them.
 *
 * The unmeasured components are DROPPED, not zeroed and not defaulted to a
 * middling 50. Both of those are the Phase 7 mistake in a new costume: a zero
 * says "they failed", a 50 says "they were average", and the truth is "nobody
 * has ever been in a position to say". Weights are renormalised across whatever
 * remains, and the count of surviving components is returned so the screen can
 * show what the letter stands on.
 */
export function scoreSupplier(components: ScorecardComponents): ScorecardScore {
  const parts: { weight: number; value: number }[] = [];

  if (components.onTimeRate !== null) {
    parts.push({ weight: SCORE_WEIGHTS.onTime, value: clamp01(components.onTimeRate) * 100 });
  }
  if (components.fillRate !== null) {
    parts.push({ weight: SCORE_WEIGHTS.fill, value: clamp01(components.fillRate) * 100 });
  }
  if (components.priceVariancePct !== null) {
    // Only OVERcharging is penalised. A supplier who invoices below the agreed
    // price has not performed badly, and scoring the absolute deviation would
    // mark them down for it.
    const over = Math.max(0, finite(components.priceVariancePct));
    const penalty = Math.min(100, (over / PRICE_VARIANCE_ZERO_AT_PCT) * 100);
    parts.push({ weight: SCORE_WEIGHTS.price, value: 100 - penalty });
  }
  if (components.damageRate !== null) {
    parts.push({ weight: SCORE_WEIGHTS.damage, value: (1 - clamp01(components.damageRate)) * 100 });
  }

  if (parts.length < MIN_SCORED_COMPONENTS) {
    return { score: null, grade: null, scoredComponents: parts.length };
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const weighted = parts.reduce((sum, p) => sum + p.weight * p.value, 0);
  const score = Math.round(weighted / totalWeight);

  return { score, grade: gradeFor(score), scoredComponents: parts.length };
}

export function gradeFor(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

// ─── 8.5 Purchase-order approval ─────────────────────────────────────────────

export const PurchaseOrderApprovalStatus = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
export type PurchaseOrderApprovalStatus = z.infer<typeof PurchaseOrderApprovalStatus>;

/** The sparx staff ladder, not Better Auth's organisation vocabulary — there is
 *  no `member` role on this platform, and `viewer` is read-only by definition, so
 *  a rule routing to either could never be satisfied and would hold an order
 *  forever with no possible approver. */
export const ApproverRole = z.enum(['owner', 'admin', 'editor']);
export type ApproverRole = z.infer<typeof ApproverRole>;

// Who a required role actually admits. Spelled out as sets rather than compared
// against a rank number, because there are exactly three of them and the ladder
// already exists in two hand-synced copies elsewhere; a third would be a third
// thing to drift.
const ADMITTED_BY: Record<ApproverRole, readonly string[]> = {
  editor: ['owner', 'admin', 'editor'],
  admin: ['owner', 'admin'],
  owner: ['owner'],
};

/**
 * May this person sign off an order the rule routed to `requiredRole`?
 *
 * The decide endpoint is `editor`-gated, which is the floor for touching buying
 * at all — so WITHOUT this check a rule reading "The owner signs it off" was
 * satisfied by the most junior person who could raise the order in the first
 * place. The rule's own words were decorative: stored, printed on the Spending
 * limits list, and never consulted. It is the same hole the route header already
 * closed for WRITING a rule ("a spending control an ordinary editor can raise
 * the threshold on is not a control") left open one step along, on signing.
 * [[feedback_a_fix_leaves_its_neighbour_behind]]
 *
 * No role on the rule means "anyone who can edit buying", which the endpoint has
 * already established — so that is a yes, not a no.
 */
export function canSignOff(
  actorRole: string | null | undefined,
  requiredRole: string | null | undefined
): boolean {
  if (requiredRole === null || requiredRole === undefined || requiredRole === '') return true;
  const admitted = ADMITTED_BY[requiredRole as ApproverRole];
  // A role nobody recognises must not hold an order forever with no possible
  // approver — the same reasoning that keeps `viewer` and `member` out of the
  // enum above.
  if (!admitted) return true;
  if (actorRole === null || actorRole === undefined || actorRole === '') return false;
  return admitted.includes(actorRole);
}

// "Every supplier", "every location" and "whoever can edit buying" are NULL on
// these four fields, and null is how a form says them: a <select> whose blank
// option means "no narrowing" sends null, not a missing key. Creating and
// editing therefore have to accept the SAME payload, and for a long time they
// did not — only the update below carried `.nullable()`, so the identical object
// saved fine on an existing rule and 400'd on a new one with "the problem is
// with Supplier id and Warehouse id" over two fields nobody had touched.
//
// The screen that sends it opens on "Any supplier · Any location", so the form's
// own default state was the unsaveable one. MEASURED 2026-09-18: ZERO rows in
// `inventory_po_approval_rules` on the whole platform — no tenant had ever
// managed to set a spending limit, which is why no purchase order has ever been
// held for sign-off either. [[feedback_a_fix_leaves_its_neighbour_behind]]
export const CreatePoApprovalRuleInput = z.object({
  name: z.string().trim().min(1).max(80),
  /** Null or omitted for "every supplier". */
  supplierId: Uuid.nullable().optional(),
  /** Null or omitted for "every location". */
  warehouseId: Uuid.nullable().optional(),
  minAmountCents: z.number().int().nonnegative().max(1_000_000_000).default(0),
  /** Null or omitted routes to the role below rather than to one person. */
  requiredApproverUserId: Uuid.nullable().optional(),
  /** Null or omitted means anyone who can edit buying. */
  requiredRole: ApproverRole.nullable().optional(),
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
  isActive: z.boolean().default(true),
});
export type CreatePoApprovalRuleInput = z.infer<typeof CreatePoApprovalRuleInput>;

// Same defaults-survive-`.partial()` trap as UpdateSupplierInput: editing a
// rule's name must not silently reactivate a rule somebody switched off, nor
// reset its threshold to "every order". Keep in sync with every `.default()`
// above — and ONLY with those. The four nullable fields are inherited through
// `.partial()` now, so there is nothing left here for them to drift from.
export const UpdatePoApprovalRuleInput = CreatePoApprovalRuleInput.partial().extend({
  minAmountCents: z.number().int().nonnegative().max(1_000_000_000).optional(),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePoApprovalRuleInput = z.infer<typeof UpdatePoApprovalRuleInput>;

export const DecidePoApprovalInput = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    note: z.string().trim().max(2000).optional(),
  })
  // "No" with no reason sends the buyer back to guess what to change, and the
  // approval trail records a refusal nobody can explain a year later.
  .refine((v) => v.decision !== 'rejected' || (v.note !== undefined && v.note.length > 0), {
    message: 'Say why you are turning this order down',
    path: ['note'],
  });
export type DecidePoApprovalInput = z.infer<typeof DecidePoApprovalInput>;

export interface ApprovalRuleCandidate {
  id: string;
  supplierId: string | null;
  warehouseId: string | null;
  minAmountCents: number;
  sortOrder: number;
  createdAt: string;
}

/**
 * Which rule holds this order, if any.
 *
 * Precedence is STATED rather than inherited from query order, because these
 * rules carry an approver and two matching rules can therefore disagree about
 * who signs. Highest cleared threshold wins — a £20k order routes to the £10k
 * approver, not the £500 one — then `sortOrder`, then the oldest rule, so the
 * answer is stable across runs.
 */
export function resolveApprovalRule(
  order: { supplierId: string; warehouseId: string; totalCents: number },
  rules: readonly ApprovalRuleCandidate[]
): ApprovalRuleCandidate | null {
  const matching = rules.filter(
    (rule) =>
      (rule.supplierId === null || rule.supplierId === order.supplierId) &&
      (rule.warehouseId === null || rule.warehouseId === order.warehouseId) &&
      order.totalCents >= rule.minAmountCents
  );
  if (matching.length === 0) return null;

  return [...matching].sort(
    (a, b) =>
      b.minAmountCents - a.minAmountCents ||
      a.sortOrder - b.sortOrder ||
      a.createdAt.localeCompare(b.createdAt)
  )[0]!;
}

// ─── 8.6 Advance ship notices ────────────────────────────────────────────────

export const AsnStatus = z.enum(['expected', 'received', 'cancelled']);
export type AsnStatus = z.infer<typeof AsnStatus>;

export const AsnSource = z.enum(['manual', 'file', 'api']);
export type AsnSource = z.infer<typeof AsnSource>;

export const AsnLineInput = z.object({
  purchaseOrderLineId: Uuid,
  /** Read as `uomCode` when one is given, exactly like a receipt line. */
  quantityShipped: z.number().int().positive().max(10_000_000),
  uomCode: z.string().trim().min(1).max(12).optional(),
  lotNumber: z.string().trim().min(1).max(63).optional(),
});
export type AsnLineInput = z.infer<typeof AsnLineInput>;

export const CreateAsnInput = z.object({
  purchaseOrderId: Uuid,
  reference: z.string().trim().max(120).nullish(),
  carrier: z.string().trim().max(80).nullish(),
  trackingNumber: z.string().trim().max(120).nullish(),
  packageCount: z.number().int().positive().max(100_000).nullish(),
  shippedAt: z.string().datetime().nullish(),
  expectedArrivalAt: z.string().datetime().nullish(),
  source: AsnSource.default('manual'),
  notes: z.string().max(2000).nullish(),
  lines: z.array(AsnLineInput).min(1).max(500),
});
export type CreateAsnInput = z.infer<typeof CreateAsnInput>;

export const UpdateAsnInput = z.object({
  reference: z.string().trim().max(120).nullable().optional(),
  carrier: z.string().trim().max(80).nullable().optional(),
  trackingNumber: z.string().trim().max(120).nullable().optional(),
  packageCount: z.number().int().positive().max(100_000).nullable().optional(),
  shippedAt: z.string().datetime().nullable().optional(),
  expectedArrivalAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateAsnInput = z.infer<typeof UpdateAsnInput>;

// ─── 8.7 Returns to supplier ─────────────────────────────────────────────────

export const SupplierReturnStatus = z.enum(['draft', 'sent', 'credited', 'closed', 'cancelled']);
export type SupplierReturnStatus = z.infer<typeof SupplierReturnStatus>;

export const SupplierReturnReason = z.enum([
  'damaged',
  'wrong_item',
  'overstock',
  'quality',
  'recall',
  'expired',
  'other',
]);
export type SupplierReturnReason = z.infer<typeof SupplierReturnReason>;

export const SupplierReturnLineInput = z.object({
  variantId: Uuid,
  quantity: z.number().int().positive().max(10_000_000),
  /** What we paid per unit. Defaulted from the linked order line, then the
   *  supplier link, then the moving average — never 0, which would record a
   *  credit expectation of nothing and quietly write the money off. */
  unitCostCents: z.number().int().nonnegative().max(1_000_000_000).optional(),
  uomCode: z.string().trim().min(1).max(12).optional(),
  lotNumber: z.string().trim().min(1).max(63).optional(),
  note: z.string().trim().max(255).optional(),
});
export type SupplierReturnLineInput = z.infer<typeof SupplierReturnLineInput>;

export const CreateSupplierReturnInput = z.object({
  supplierId: Uuid,
  warehouseId: Uuid,
  purchaseOrderId: Uuid.nullish(),
  reason: SupplierReturnReason,
  rmaNumber: z.string().trim().max(64).nullish(),
  carrier: z.string().trim().max(80).nullish(),
  trackingNumber: z.string().trim().max(120).nullish(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'A currency code is three letters, like USD or GBP')
    .default('USD'),
  notes: z.string().max(2000).nullish(),
  lines: z.array(SupplierReturnLineInput).min(1).max(500),
});
export type CreateSupplierReturnInput = z.infer<typeof CreateSupplierReturnInput>;

export const UpdateSupplierReturnInput = z.object({
  reason: SupplierReturnReason.optional(),
  rmaNumber: z.string().trim().max(64).nullable().optional(),
  carrier: z.string().trim().max(80).nullable().optional(),
  trackingNumber: z.string().trim().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateSupplierReturnInput = z.infer<typeof UpdateSupplierReturnInput>;

/** Record what the supplier actually credited. Separate from `update` because it
 *  is a different act with a different meaning: the first edits paperwork, this
 *  one closes a debt. */
export const RecordSupplierCreditInput = z.object({
  creditReceivedCents: z.number().int().nonnegative().max(1_000_000_000),
  /** Defaults to now. */
  resolvedAt: z.string().datetime().optional(),
  note: z.string().trim().max(2000).optional(),
});
export type RecordSupplierCreditInput = z.infer<typeof RecordSupplierCreditInput>;

// ─── 8.8 Supplier bills + the three-way match ────────────────────────────────

export const SupplierBillStatus = z.enum([
  'draft',
  'awaiting_approval',
  'approved',
  'disputed',
  'paid',
  'cancelled',
]);
export type SupplierBillStatus = z.infer<typeof SupplierBillStatus>;

export const SupplierBillLineInput = z.object({
  /** Omit on a line that matches nothing — freight, a deposit, or a part they
   *  billed that was never ordered. That last one is the case the match exists
   *  to make visible, so it must be enterable. */
  purchaseOrderLineId: Uuid.optional(),
  variantId: Uuid.optional(),
  description: z.string().trim().max(255).optional(),
  quantity: z.number().int().positive().max(10_000_000),
  unitCostCents: z.number().int().nonnegative().max(1_000_000_000),
  /** As printed. Defaults to quantity × unit cost when omitted. */
  amountCents: z.number().int().max(1_000_000_000).optional(),
  uomCode: z.string().trim().min(1).max(12).optional(),
});
export type SupplierBillLineInput = z.infer<typeof SupplierBillLineInput>;

export const CreateSupplierBillInput = z.object({
  supplierId: Uuid,
  purchaseOrderId: Uuid.nullish(),
  /** Their invoice number. */
  number: z.string().trim().min(1).max(40),
  billedAt: z.string().datetime(),
  dueAt: z.string().datetime().nullish(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'A currency code is three letters, like USD or GBP')
    .default('USD'),
  fxRate: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,8})?$/, 'Enter a rate like 1.0842, with up to eight decimal places')
    .refine((v) => Number(v) > 0, 'A rate has to be greater than zero')
    .optional(),
  taxCents: z.number().int().nonnegative().max(1_000_000_000).default(0),
  freightCents: z.number().int().nonnegative().max(1_000_000_000).default(0),
  notes: z.string().max(2000).nullish(),
  lines: z.array(SupplierBillLineInput).min(1).max(500),
});
export type CreateSupplierBillInput = z.infer<typeof CreateSupplierBillInput>;

export const UpdateSupplierBillInput = z.object({
  number: z.string().trim().min(1).max(40).optional(),
  purchaseOrderId: Uuid.nullable().optional(),
  billedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  taxCents: z.number().int().nonnegative().max(1_000_000_000).optional(),
  freightCents: z.number().int().nonnegative().max(1_000_000_000).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateSupplierBillInput = z.infer<typeof UpdateSupplierBillInput>;

export const RecordBillPaymentInput = z.object({
  paidCents: z.number().int().nonnegative().max(1_000_000_000),
  paidAt: z.string().datetime().optional(),
  note: z.string().trim().max(2000).optional(),
});
export type RecordBillPaymentInput = z.infer<typeof RecordBillPaymentInput>;

export const AcceptBillVarianceInput = z.object({
  /** Required: accepting a variance without saying why is indistinguishable
   *  from not having noticed it. */
  note: z.string().trim().min(1).max(2000),
});
export type AcceptBillVarianceInput = z.infer<typeof AcceptBillVarianceInput>;

/** How far off a line may be before the match calls it out. Tenants who round
 *  differently from their suppliers otherwise see a wall of one-penny
 *  "discrepancies" and stop reading the screen — which costs more than the
 *  pennies do. */
export const MATCH_PRICE_TOLERANCE_CENTS = 1;

export type MatchVerdict =
  | 'matched'
  | 'not_received'
  | 'over_billed'
  | 'under_billed'
  | 'price_higher'
  | 'price_lower'
  | 'unordered';

export interface MatchLineInput {
  /** Null when the bill line points at nothing in the order. */
  purchaseOrderLineId: string | null;
  billedQuantity: number;
  billedUnitCostCents: number;
  /** Null when there is no matching order line. */
  orderedQuantity: number | null;
  orderedUnitCostCents: number | null;
  /** Null when there is no matching order line; 0 is a real answer meaning
   *  "ordered, billed, and nothing has turned up". */
  receivedQuantity: number | null;
  /** Units of this order line already charged for on every OTHER live bill.
   *
   *  A purchase order that arrives in several drops is invoiced in several
   *  invoices, so "what arrived" is not what THIS invoice is entitled to
   *  charge for - what is LEFT is. Omit it (or pass 0) on a one-drop,
   *  one-invoice order and the check behaves exactly as it always has. */
  alreadyBilledQuantity?: number | null;
}

export interface MatchLineResult {
  verdict: MatchVerdict;
  /** Billed minus what was LEFT to invoice (arrived, less whatever other live
   *  bills already charged for). Positive = charged for more than is left, so
   *  somebody is being billed twice or for goods that never came. Negative =
   *  units that arrived and are on no invoice yet, which on a multi-drop order
   *  is the normal state between deliveries. Null when there is nothing to
   *  compare against. */
  quantityVarianceUnits: number | null;
  /** Billed minus agreed, per unit. Positive = they charged more. */
  priceVarianceCents: number | null;
  /** The money wrongly charged ON THIS LINE: units charged for that are not
   *  available to invoice, plus the price gap on the units that are. Positive
   *  means the bill is higher than the goods justify.
   *
   *  A SHORTFALL contributes nothing to it. Nothing is at stake in a unit
   *  nobody has invoiced — see `uninvoicedCents`. */
  amountVarianceCents: number | null;
  /** What the units that arrived and are on no invoice yet are worth, at the
   *  agreed price. Zero on a line that charges for everything left. Null when
   *  there is no order line to compare against. */
  uninvoicedCents: number | null;
  /** True for anything a person should look at before this is paid. */
  needsReview: boolean;
}

/**
 * One line of the three-way match.
 *
 * The comparison is billed-vs-RECEIVED, not billed-vs-ordered, and that is the
 * whole point. A supplier who ships eight of the ten you ordered and invoices
 * for ten has not made an ordering error; they have billed for goods that are
 * not on your shelf, and only the receipt knows. Checking against the order
 * would wave it through.
 *
 * Price is compared against the AGREED price on the order rather than against
 * anything on the delivery, because that is what was actually negotiated.
 *
 * Three things this gets right that a naive billed-vs-received does not:
 *
 * 1. IT COUNTS THE OTHER INVOICES. An order that arrives in two drops is
 *    invoiced twice, and each invoice may only charge for what is left. Compare
 *    against the raw received total and every invoice but the last reads short;
 *    worse, a supplier who invoices the SAME drop twice matches perfectly both
 *    times, because neither invoice on its own exceeds what arrived.
 *
 * 2. PRICE IS CHECKED BEFORE A SHORTFALL, NOT AFTER. A partial invoice that
 *    also overcharges used to report only the quantity gap, because the
 *    quantity branch was tested first and won. The quantity gap on a partial
 *    invoice is expected; the overcharge is the thing that costs money. Money
 *    first.
 *
 * 3. BEING CHARGED FOR LESS THAN ARRIVED NEVER STOPS A PAYMENT. It is reported,
 *    because knowing another invoice is coming and roughly what it is worth is
 *    genuinely useful, but it is information rather than a disagreement. There
 *    is nothing to accept and nothing to query: paying the smaller invoice
 *    costs the business nothing, and blocking it forces somebody either to sign
 *    off a variance that never happened or to dispute a correct invoice.
 */
export function matchBillLine(line: MatchLineInput): MatchLineResult {
  const billedQty = Math.max(0, Math.floor(finite(line.billedQuantity)));
  const billedCost = Math.round(finite(line.billedUnitCostCents));

  if (line.purchaseOrderLineId === null || line.orderedQuantity === null) {
    // Billed for something nobody ordered. Not a variance to be netted off — a
    // line that should not exist, so it is called out on its own terms.
    return {
      verdict: 'unordered',
      quantityVarianceUnits: null,
      priceVarianceCents: null,
      amountVarianceCents: billedQty * billedCost,
      uninvoicedCents: null,
      needsReview: true,
    };
  }

  const received = Math.max(0, Math.floor(finite(line.receivedQuantity ?? 0)));
  const alreadyBilled = Math.max(0, Math.floor(finite(line.alreadyBilledQuantity ?? 0)));
  // What THIS invoice may charge for. Never negative: if other invoices have
  // already covered everything that arrived, there is nothing left, and any
  // quantity here is one too many.
  const billable = Math.max(0, received - alreadyBilled);
  const agreed = Math.round(finite(line.orderedUnitCostCents ?? 0));
  const qtyVariance = billedQty - billable;
  const priceVariance = billedCost - agreed;

  // Valued at the agreed price so the two variances do not double-count each
  // other: the quantity gap is worth what those units should have cost, and the
  // price gap is worth the overcharge on the units this invoice may charge for.
  //
  // A SHORTFALL is deliberately excluded. This figure reads on screen as the
  // money at stake, and folding in the value of goods nobody has invoiced yet
  // made an overcharging PARTIAL invoice report a large sum in the tenant's
  // favour: billed 2 at $20 against an agreed $18 on a line where 40 arrived
  // came out at -$680.00, thanking a supplier for a $4.00 overcharge.
  const amountVariance =
    Math.max(0, qtyVariance) * agreed + priceVariance * Math.min(billedQty, billable);
  // The shortfall, on its own terms: what has arrived, is on no invoice, and is
  // therefore still to be charged for.
  const uninvoicedCents = Math.max(0, -qtyVariance) * agreed;

  // Order matters. Anything that costs money is decided BEFORE a shortfall,
  // because a shortfall on a partial invoice is the expected state and would
  // otherwise hide an overcharge sitting on the same line.
  const verdict: MatchVerdict =
    received === 0 && billedQty > 0
      ? 'not_received'
      : qtyVariance > 0
        ? 'over_billed'
        : priceVariance > MATCH_PRICE_TOLERANCE_CENTS
          ? 'price_higher'
          : priceVariance < -MATCH_PRICE_TOLERANCE_CENTS
            ? 'price_lower'
            : qtyVariance < 0
              ? 'under_billed'
              : 'matched';

  return {
    verdict,
    quantityVarianceUnits: qtyVariance,
    priceVarianceCents: priceVariance,
    amountVarianceCents: amountVariance,
    uninvoicedCents,
    // `price_lower` is in the tenant's favour and still needs a look: a
    // supplier who undercharges today issues a correction next month, and a
    // business that spent the difference is the one that gets hurt.
    //
    // `under_billed` does NOT, and that is the difference. It is not a supplier
    // charging the wrong price for what they sent; it is goods that have
    // arrived and have not been invoiced yet, which on any order that arrives
    // in more than one drop is simply where the paperwork is up to. Reported,
    // never blocking.
    needsReview: verdict !== 'matched' && verdict !== 'under_billed',
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, finite(n)));
}
