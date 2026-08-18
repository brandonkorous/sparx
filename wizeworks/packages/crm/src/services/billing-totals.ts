// Billing-document total computation (docs/87 §7).
//
// Distinct from order-totals: a billing document taxes PER LINE (each line's
// `taxable` flag) against a single document-level `taxRate`, rather than taking
// a caller-supplied header tax. Tax is charged on the post-discount line amount.
// Resolution order: lines → subtotal → discount → tax (per-line taxable ×
// rate) → shipping → surcharge → total (docs/87 §7). Money is dollars; persisted
// as Decimal(12,2).

export interface BillingLineForTotals {
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxable: boolean;
}

export interface ComputedBillingLine {
  lineSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface ComputedBillingTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  surchargeTotal: number;
  total: number;
}

/** Per-line numbers. Tax is charged on (subtotal − discount) when the line is
 *  taxable, at the document's rate (0.0875 = 8.75%). */
export function computeBillingLine(
  line: BillingLineForTotals,
  taxRate: number
): ComputedBillingLine {
  const lineSubtotal = round2(line.quantity * line.unitPrice);
  const discountAmount = round2(line.discountAmount ?? 0);
  const taxBase = Math.max(0, lineSubtotal - discountAmount);
  const taxAmount = line.taxable ? round2(taxBase * taxRate) : 0;
  const lineTotal = round2(lineSubtotal - discountAmount + taxAmount);
  return { lineSubtotal, discountAmount, taxAmount, lineTotal };
}

/** Header totals from the document's lines + document-level shipping & surcharge.
 *  `taxRate` drives per-line tax; `surchargeTotal` (docs/48 §6) is added last. */
export function computeBillingTotals(
  lines: BillingLineForTotals[],
  taxRate: number,
  shippingTotal = 0,
  surchargeTotal = 0
): ComputedBillingTotals {
  let subtotal = 0;
  let discountSum = 0;
  let taxSum = 0;

  for (const line of lines) {
    const computed = computeBillingLine(line, taxRate);
    subtotal += computed.lineSubtotal;
    discountSum += computed.discountAmount;
    taxSum += computed.taxAmount;
  }

  const shipping = round2(shippingTotal);
  const surcharge = round2(surchargeTotal);
  const taxTotal = round2(taxSum);
  const discountTotal = round2(discountSum);
  const total = round2(round2(subtotal) - discountTotal + taxTotal + shipping + surcharge);

  return {
    subtotal: round2(subtotal),
    discountTotal,
    taxTotal,
    shippingTotal: shipping,
    surchargeTotal: surcharge,
    total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
