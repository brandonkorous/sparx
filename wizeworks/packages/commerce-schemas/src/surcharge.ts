// Surcharge rules (docs/48 §6) — schemas + the pure document-fee engine.
//
// A surcharge passes through a transaction cost the merchant incurs (chiefly
// the card processing fee). It applies to a document TOTAL (not a product
// cost), is gated by payment method, and is snapshotted for refund proration.
// Prisma-free so the checkout-service, refund flow, and a future invoice path
// all share one deterministic computation. Money is integer cents.

import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────

export const SurchargeType = z.enum(['percentage', 'flat']);
export type SurchargeType = z.infer<typeof SurchargeType>;

export const SurchargeBasis = z.enum(['subtotal', 'subtotal_plus_shipping', 'total']);
export type SurchargeBasis = z.infer<typeof SurchargeBasis>;

export const SurchargeAppliesTo = z.enum(['checkout', 'invoice', 'both']);
export type SurchargeAppliesTo = z.infer<typeof SurchargeAppliesTo>;

// Coarse payment-method classification a checkout/invoice resolves to. `card`
// = any card-processor checkout; `account` = B2B net-terms / no provider.
export const SurchargePaymentMethod = z.enum(['card', 'account', 'ach', 'check', 'other']);
export type SurchargePaymentMethod = z.infer<typeof SurchargePaymentMethod>;

// ─── Rule CRUD input ──────────────────────────────────────────────────

const SurchargeRuleObject = z.object({
  name: z.string().min(1).max(255),
  type: SurchargeType.default('percentage'),
  // percent (3.0 = 3%) for percentage; dollars (5.00) for flat.
  value: z.number().finite().nonnegative(),
  basis: SurchargeBasis.default('total'),
  paymentMethods: z.array(SurchargePaymentMethod).min(1).max(8).default(['card']),
  appliesTo: SurchargeAppliesTo.default('both'),
  label: z.string().min(1).max(120),
  capCents: z.number().int().positive().max(100_000_000).nullable().optional(),
  isActive: z.boolean().default(false),
});

function refineSurcharge(v: { type?: SurchargeType; value?: number }, ctx: z.RefinementCtx): void {
  if (v.type === 'percentage' && v.value != null && v.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: 'A percentage surcharge cannot exceed 100%',
    });
  }
}

export const CreateSurchargeRuleInput = SurchargeRuleObject.superRefine(refineSurcharge);
export type CreateSurchargeRuleInput = z.infer<typeof CreateSurchargeRuleInput>;

// Defaults stripped before `.partial()` (a `.default()` survives it, and the
// service writes every non-undefined key). This one moved money: editing a
// surcharge's label alone turned a FLAT fee back into a PERCENTAGE, reset the
// basis it is calculated on, narrowed the payment methods it applies to back to
// card only, and switched the rule off (isActive defaults to false on create).
export const UpdateSurchargeRuleInput = SurchargeRuleObject.extend({
  type: SurchargeType,
  basis: SurchargeBasis,
  paymentMethods: z.array(SurchargePaymentMethod).min(1).max(8),
  appliesTo: SurchargeAppliesTo,
  isActive: z.boolean(),
})
  .partial()
  .superRefine(refineSurcharge);
export type UpdateSurchargeRuleInput = z.infer<typeof UpdateSurchargeRuleInput>;

// ─── The pure engine ──────────────────────────────────────────────────

export interface SurchargeRuleSpec {
  id?: string;
  name: string;
  type: SurchargeType;
  value: number;
  basis: SurchargeBasis;
  paymentMethods: SurchargePaymentMethod[];
  label: string;
  capCents?: number | null;
}

// The document amounts a surcharge basis can read (all cents, post-discount).
export interface SurchargeBasisInput {
  subtotalCents: number; // line subtotal, net of discounts
  shippingCents: number;
  taxCents: number;
  paymentMethod: SurchargePaymentMethod;
}

// One snapshotted surcharge line — persisted on the order/invoice for
// reproducibility + proportional refund reversal.
export interface AppliedSurcharge {
  ruleId?: string;
  name: string;
  type: SurchargeType;
  value: number;
  basis: SurchargeBasis;
  paymentMethod: SurchargePaymentMethod;
  basisCents: number;
  amountCents: number;
  label: string;
}

export interface SurchargeResult {
  totalCents: number;
  applied: AppliedSurcharge[];
}

function basisCentsFor(basis: SurchargeBasis, doc: SurchargeBasisInput): number {
  switch (basis) {
    case 'subtotal':
      return Math.max(0, doc.subtotalCents);
    case 'subtotal_plus_shipping':
      return Math.max(0, doc.subtotalCents + doc.shippingCents);
    case 'total':
      return Math.max(0, doc.subtotalCents + doc.shippingCents + doc.taxCents);
  }
}

/**
 * Compute every applicable surcharge for a document (docs/48 §6.3). A rule
 * applies only when its `paymentMethods` includes the document's method.
 * Multiple rules sum (e.g. a 3% card fee + a $5 small-order fee). Pure and
 * deterministic — the caller pre-filters to active rules of the right
 * `appliesTo` and supplies the post-discount amounts.
 */
export function applySurcharges(
  rules: SurchargeRuleSpec[],
  doc: SurchargeBasisInput
): SurchargeResult {
  const applied: AppliedSurcharge[] = [];
  let total = 0;
  for (const rule of rules) {
    if (!rule.paymentMethods.includes(doc.paymentMethod)) continue;
    const basisCents = basisCentsFor(rule.basis, doc);
    let amount =
      rule.type === 'percentage'
        ? Math.round((basisCents * rule.value) / 100)
        : Math.round(rule.value * 100);
    if (rule.capCents != null && rule.capCents >= 0) amount = Math.min(amount, rule.capCents);
    amount = Math.max(0, amount);
    if (amount === 0) continue;
    applied.push({
      ruleId: rule.id,
      name: rule.name,
      type: rule.type,
      value: rule.value,
      basis: rule.basis,
      paymentMethod: doc.paymentMethod,
      basisCents,
      amountCents: amount,
      label: rule.label,
    });
    total += amount;
  }
  return { totalCents: total, applied };
}

/**
 * Reverse the surcharge proportionally when part of an order is refunded
 * (docs/48 §6.3). Returns the cents of surcharge attributable to a refund of
 * `refundCents` against an order whose grand total was `orderTotalCents`.
 */
export function proratedSurchargeReversal(
  appliedSurchargeTotalCents: number,
  refundCents: number,
  orderTotalCents: number
): number {
  if (orderTotalCents <= 0 || appliedSurchargeTotalCents <= 0 || refundCents <= 0) return 0;
  const ratio = Math.min(1, refundCents / orderTotalCents);
  return Math.round(appliedSurchargeTotalCents * ratio);
}
