// The pure arithmetic behind entering a supplier's invoice: seeding lines from
// the order, adding up what was charged, and shaping what gets sent.

import type { PurchaseOrderDetail } from './purchase-orders-data';
import type { SupplierBillInput } from './supplier-bills-data';
import { moneyCents, moneyText } from '../../components/money-input';
import { NOT_A_DATE, dayStartUtc } from '../../lib/today';

export interface BillDraftLine {
  purchaseOrderLineId: string;
  variantId: string;
  sku: string | null;
  title: string | null;
  /** Whole units as typed. */
  quantity: string;
  /** Whole currency units as typed. */
  unitCost: string;
  /** What the order agreed, for the "they have changed it" hint. */
  agreedUnitCostCents: number;
  receivedQuantity: number;
}

export function todayIso(): string {
  return new Date().toISOString();
}

/** Received quantity, agreed price: what the invoice SHOULD say. */
export function seedBillLines(order: PurchaseOrderDetail): BillDraftLine[] {
  return order.lines.map((line) => ({
    purchaseOrderLineId: line.id,
    variantId: line.variantId,
    sku: line.variantSku,
    title: line.productTitle ?? line.description,
    quantity: String(line.quantityReceived > 0 ? line.quantityReceived : line.quantityOrdered),
    unitCost: moneyText(line.unitCostCents),
    agreedUnitCostCents: line.unitCostCents,
    receivedQuantity: line.quantityReceived,
  }));
}

// Amounts are read the way a person writes them: "1,250.00", "$8.00",
// "8,50", rather than the one spelling `Number.parseFloat` knows (issue 486).
// A quantity is a count, not money, so it keeps its own parse.
export function billAmounts(lines: BillDraftLine[], freight: string, tax: string) {
  const goodsCents = lines.reduce((sum, line) => {
    const qty = Number.parseFloat(line.quantity);
    const cost = moneyCents(line.unitCost);
    if (!Number.isFinite(qty) || cost === null) return sum;
    return sum + Math.round(qty * cost);
  }, 0);
  const freightCents = moneyCents(freight) ?? 0;
  const taxCents = moneyCents(tax) ?? 0;
  return { goodsCents, freightCents, taxCents };
}

// A date box can hold something that is not a date; see `lib/today`.
export function billDates(billedAt: string, dueAt: string) {
  const billedIso = dayStartUtc(billedAt);
  const dueIso = dueAt === '' ? null : dayStartUtc(dueAt);
  const billedError = billedAt !== '' && billedIso === null ? NOT_A_DATE : null;
  const dueError = dueAt !== '' && dueIso === null ? NOT_A_DATE : null;
  return { billedIso, dueIso, billedError, dueError };
}

export interface BillInputParts {
  supplierId: string;
  purchaseOrderId: string;
  number: string;
  billedIso: string;
  dueIso: string | null;
  currency: string;
  taxCents: number;
  freightCents: number;
  lines: BillDraftLine[];
}

export function supplierBillInput({
  supplierId,
  purchaseOrderId,
  number,
  billedIso,
  dueIso,
  currency,
  taxCents,
  freightCents,
  lines,
}: BillInputParts): SupplierBillInput {
  return {
    supplierId,
    purchaseOrderId,
    number: number.trim(),
    billedAt: billedIso,
    ...(dueIso === null ? {} : { dueAt: dueIso }),
    currency,
    taxCents,
    freightCents,
    lines: lines.map((line) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      variantId: line.variantId,
      quantity: Math.round(Number.parseFloat(line.quantity)),
      unitCostCents: moneyCents(line.unitCost) ?? 0,
    })),
  };
}
