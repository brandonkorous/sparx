// The lines an order's net-terms invoice is raised with: the quote's when the
// order came from one (sparx persona issue 086), else the order's own items
// (issue 095, `itemizedFromOrder` below).
//
// An order's invoice was always ONE line carrying the order total. For an order
// made from a quote that threw away every line's cost, so the invoice showed no
// margin where the quote it came from showed one, on the same sale. Raised from
// a quote, the invoice now carries the quote's own lines, each with the cost the
// quote kept for it. A line with no cost stays null: never $0.
//
// THE ORDER TOTAL IS THE AUTHORITY. The quote's lines, tax rate, delivery and
// surcharge are worked through the same totals rule the invoice will be, and
// used only when they come to the order total to the cent. If anything moved
// in between (a held order signed off after the quote changed), the invoice is
// the single order line it always was, so the amount billed never moves.
//
// Cost is the business's own figure. It rides on the invoice line for staff and
// is never printed or emailed (buyer-output-has-no-cost.test.ts).

import type { Prisma } from '@wizeworks/db';

import { computeBillingTotals } from './billing-totals';

/** A quote line, as much of it as an invoice line copies. */
export interface QuoteLineForInvoice {
  lineTypeId: string | null;
  productId: string | null;
  variantId: string | null;
  description: string;
  quantity: Prisma.Decimal | number;
  unitPrice: Prisma.Decimal | number;
  costCents: number | null;
  taxable: boolean;
  discountAmount: Prisma.Decimal | number;
  taxAmount: Prisma.Decimal | number;
  lineSubtotal: Prisma.Decimal | number;
  lineTotal: Prisma.Decimal | number;
  coreCharge: Prisma.Decimal | number | null;
  sortOrder: number;
  metadata: Prisma.JsonValue;
}

export interface QuoteForInvoice {
  taxRate: Prisma.Decimal | number;
  shippingTotal: Prisma.Decimal | number;
  surchargeTotal: Prisma.Decimal | number;
  lines: QuoteLineForInvoice[];
}

/** What the invoice is written with: its header money fields and its lines. */
export interface ItemizedInvoice {
  taxRate: number;
  shippingTotal: number;
  surchargeTotal: number;
  lines: {
    lineTypeId: string | null;
    productId: string | null;
    variantId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    costCents: number | null;
    taxable: boolean;
    discountAmount: number;
    taxAmount: number;
    lineSubtotal: number;
    lineTotal: number;
    coreCharge: number | null;
    sortOrder: number;
    metadata: Prisma.InputJsonValue;
  }[];
}

/**
 * The quote's lines as invoice lines, or null when they do not come to `amount`
 * (the order total, in dollars). Pure, so the rule is tested without a database.
 */
export function itemizedFromQuote(quote: QuoteForInvoice, amount: number): ItemizedInvoice | null {
  if (quote.lines.length === 0) return null;
  const lines = [...quote.lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line, index) => ({
      lineTypeId: line.lineTypeId,
      productId: line.productId,
      variantId: line.variantId,
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      // Carried as it is: a cost the quote never had is still not one here.
      costCents: line.costCents,
      taxable: line.taxable,
      discountAmount: Number(line.discountAmount),
      taxAmount: Number(line.taxAmount),
      lineSubtotal: Number(line.lineSubtotal),
      lineTotal: Number(line.lineTotal),
      coreCharge: line.coreCharge === null ? null : Number(line.coreCharge),
      sortOrder: index,
      metadata: line.metadata ?? {},
    }));
  const taxRate = Number(quote.taxRate);
  const shippingTotal = Number(quote.shippingTotal);
  const surchargeTotal = Number(quote.surchargeTotal);
  const totals = computeBillingTotals(lines, taxRate, shippingTotal, surchargeTotal);
  if (Math.round(totals.total * 100) !== Math.round(amount * 100)) return null;
  return { taxRate, shippingTotal, surchargeTotal, lines };
}

/**
 * An order item's name on the invoice, with its part code when the name does
 * not already carry it.
 *
 * Gillett names a part "Bosch Remanufactured Fuel Injector (0986435621)", code
 * and all, so appending the code unconditionally printed it twice on every
 * invoice raised from an order (sparx persona issue 077, the same defect as the
 * quote editor's line description).
 */
export function invoiceLineName(name: string, sku: string | null | undefined): string {
  const code = sku?.trim() ?? '';
  if (code === '' || name.toLowerCase().includes(code.toLowerCase())) return name;
  return `${name} (${code})`;
}

/**
 * The single tax rate that reproduces this order's tax.
 *
 * The order stores tax per line, already computed by the tax service against the
 * place it was sold into. A billing document stores ONE rate and applies it to
 * whichever lines are marked taxable — so the rate is derived from the taxable
 * lines alone, not the whole subtotal, or an order with one exempt line would
 * come out under-taxed.
 *
 * Exact for the ordinary case, which is one tax place per order. An order that
 * somehow carried two different rates would round to a blended one; the order
 * remains the record of what was actually charged.
 */
export function taxRateFrom(lines: { lineSubtotal: number; taxAmount: number }[]): number {
  const taxable = lines.filter((l) => l.taxAmount > 0);
  const base = taxable.reduce((acc, l) => acc + l.lineSubtotal, 0);
  if (base <= 0) return 0;
  const tax = taxable.reduce((acc, l) => acc + l.taxAmount, 0);
  // Decimal(6,4) on the column — four places is the precision it can hold.
  return Math.round((tax / base) * 10_000) / 10_000;
}

/** An order item, as much of it as an invoice line copies. */
export interface OrderItemForInvoice {
  name: string;
  sku: string | null;
  quantity: Prisma.Decimal | number;
  unitPrice: Prisma.Decimal | number;
  lineSubtotal: Prisma.Decimal | number;
  discountAmount: Prisma.Decimal | number;
  taxAmount: Prisma.Decimal | number;
  coreCharge: Prisma.Decimal | number | null;
  productId: string | null;
  variantId: string | null;
}

export interface OrderForInvoice {
  shippingTotal: Prisma.Decimal | number;
  surchargeTotal: Prisma.Decimal | number;
  items: OrderItemForInvoice[];
}

/**
 * The order's own items as invoice lines, or null when they do not come to
 * `amount` (the order total, in dollars). The same lines "Make an invoice"
 * writes, for an order on account that came from the shop rather than a quote.
 *
 * Every such invoice was ONE line, "Order O-000012", $3,715.00: no part, no
 * quantity, and Salt Lake County's $400.00 refundable core deposit folded into
 * the price of goods under a footer telling them to return the cores for credit
 * (sparx persona issue 095). A fleet's accounts department cannot match that to
 * its purchase order, and nobody can tell from it what the refund will be.
 *
 * As with a quote, the order total is the authority: an order whose items do
 * not reach it to the cent (a discount the items do not carry) keeps the single
 * order line, so the amount billed never moves. Order items keep no cost, so
 * none is carried: null, never $0.
 */
export function itemizedFromOrder(order: OrderForInvoice, amount: number): ItemizedInvoice | null {
  if (order.items.length === 0) return null;
  const lines = order.items.map((item, index) => {
    const lineSubtotal = Number(item.lineSubtotal);
    const taxAmount = Number(item.taxAmount);
    const discountAmount = Number(item.discountAmount);
    return {
      lineTypeId: null,
      productId: item.productId,
      variantId: item.variantId,
      description: invoiceLineName(item.name, item.sku),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      costCents: null,
      // Taxable exactly where the order taxed it, so an exempt line stays exempt.
      taxable: taxAmount > 0,
      discountAmount,
      taxAmount,
      lineSubtotal,
      lineTotal: Math.round((lineSubtotal - discountAmount + taxAmount) * 100) / 100,
      coreCharge: item.coreCharge === null ? null : Number(item.coreCharge),
      sortOrder: index,
      metadata: {},
    };
  });
  const taxRate = taxRateFrom(lines);
  const shippingTotal = Number(order.shippingTotal);
  const surchargeTotal = Number(order.surchargeTotal);
  const totals = computeBillingTotals(lines, taxRate, shippingTotal, surchargeTotal);
  if (Math.round(totals.total * 100) !== Math.round(amount * 100)) return null;
  return { taxRate, shippingTotal, surchargeTotal, lines };
}

/** A quote line, as much of it as matching an order item needs. */
export interface QuoteLineCost {
  description: string;
  variantId: string | null;
  quantity: Prisma.Decimal | number;
  unitPrice: Prisma.Decimal | number;
  costCents: number | null;
}

/**
 * Each order item's cost, from the quote line it was made from, for an invoice
 * raised one line per item ("Make an invoice"). Order items keep no cost, so the
 * quote is the only place it lives. A match is the same description, part,
 * quantity (rounded, as the conversion rounds it) and price, and each quote line
 * is used once. An item that matches nothing gets null, never a guess or $0.
 */
export function quoteCostsForItems(
  items: readonly { name: string; variantId: string | null; quantity: number; unitPrice: number }[],
  quoteLines: readonly QuoteLineCost[]
): (number | null)[] {
  const used = new Set<number>();
  return items.map((it) => {
    const index = quoteLines.findIndex(
      (line, i) =>
        !used.has(i) &&
        line.description === it.name &&
        (line.variantId ?? null) === (it.variantId ?? null) &&
        Math.round(Number(line.quantity)) === it.quantity &&
        Math.round(Number(line.unitPrice) * 100) === Math.round(it.unitPrice * 100)
    );
    if (index < 0) return null;
    used.add(index);
    return quoteLines[index]?.costCents ?? null;
  });
}

/** The itemized invoice for an order made from a quote, or null for any other
 *  order (checkout, a manual bill) or a quote whose lines no longer fit. */
export async function quoteLinesForOrder(
  tx: Prisma.TransactionClient,
  convertedFromDocumentId: string | null | undefined,
  amount: number
): Promise<ItemizedInvoice | null> {
  if (!convertedFromDocumentId) return null;
  const quote = await tx.billingDocument.findUnique({
    where: { id: convertedFromDocumentId },
    select: {
      taxRate: true,
      shippingTotal: true,
      surchargeTotal: true,
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return quote ? itemizedFromQuote(quote, amount) : null;
}
