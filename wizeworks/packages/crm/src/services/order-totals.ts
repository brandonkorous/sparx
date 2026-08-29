// Order/quote total computation.
//
// Subtotal / tax / discount / shipping / total derivation is the same on
// both orders and quotes — extracted here so the rules don't drift between
// services. Line items are the source of truth for subtotal + discount +
// tax; shipping is a header-level add.
//
// All math uses regular JS numbers; persisted as Decimal(12,2). Prisma's
// Decimal type handles the conversion at write time. Inputs are validated
// nonnegative by Zod (see common-commerce.ts).

import type { LineItemInput } from '@wizeworks/crm-schemas';

export interface ComputedTotals {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  shippingTotal: number;
  surchargeTotal: number;
  total: number;
}

export interface ComputedLine {
  lineSubtotal: number;
  taxAmount: number;
  discountAmount: number;
  lineTotal: number;
}

/** Per-line numbers. Subtotal = quantity × unitPrice. lineTotal =
 *  subtotal − discount + tax. */
export function computeLine(item: LineItemInput): ComputedLine {
  const lineSubtotal = round2(item.quantity * item.unitPrice);
  const discountAmount = round2(item.discountAmount ?? 0);
  const taxAmount = round2(item.taxAmount ?? 0);
  const lineTotal = round2(lineSubtotal - discountAmount + taxAmount);
  return { lineSubtotal, discountAmount, taxAmount, lineTotal };
}

/** Header totals from a set of line items + header-level shipping. If
 *  taxTotalOverride is supplied it wins over the sum of line taxes — the
 *  service uses this when the caller passed an explicit headerTax (most
 *  tax engines compute at the order level, not per line). */
export function computeTotals(
  items: LineItemInput[],
  shippingTotal: number,
  taxTotalOverride?: number,
  // Document-level surcharge (docs/48 §6) — added last, after tax. Defaults to
  // 0 so callers that don't surcharge (quotes, most orders) are unaffected.
  surchargeTotal = 0,
  // Header-level discount, exactly like taxTotalOverride: supplied, it wins
  // over the sum of line discounts. It had no parameter at all, so a cart's
  // saving reached `create()` as an input field nothing read — a checkout
  // quoting $129.20 wrote an order for $152.00, and an imported order dropped
  // its spreadsheet's discount column (issue 298). Undefined still means "sum
  // the lines", so a caller that discounts per line is unchanged.
  discountTotalOverride?: number
): ComputedTotals {
  let subtotal = 0;
  let lineTaxSum = 0;
  let discountSum = 0;

  for (const item of items) {
    const line = computeLine(item);
    subtotal += line.lineSubtotal;
    lineTaxSum += line.taxAmount;
    discountSum += line.discountAmount;
  }

  const taxTotal = round2(taxTotalOverride ?? lineTaxSum);
  const discountTotal = round2(discountTotalOverride ?? discountSum);
  const shipping = round2(shippingTotal);
  const surcharge = round2(surchargeTotal);
  const total = round2(subtotal - discountTotal + taxTotal + shipping + surcharge);

  return {
    subtotal: round2(subtotal),
    taxTotal,
    discountTotal,
    shippingTotal: shipping,
    surchargeTotal: surcharge,
    total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
