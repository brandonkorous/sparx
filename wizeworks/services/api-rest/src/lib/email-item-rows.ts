// The item rows an email's table prints, for a parcel and for an invoice.
//
// A parcel (sparx persona issue 358): the shipping email printed the ORDER's
// lines under "Shipped". Renée's O-000008 went in two parcels and the email for
// one of them listed all six injectors.
//
// An invoice (sparx persona issue 361): its lines were given as `description`,
// and the item table reads `name`, so every invoice email's table had a quantity
// and a price with no item; and its core deposits were not listed at all.

import { firstText, money, qty } from './email-format.js';

interface Row {
  name: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

/** The refundable core deposit under a part, the way the order's own list prints it. */
function depositRow(name: string, quantity: number, coreCharge: unknown): Row {
  return {
    name: `Refundable core deposit: ${name}. Paid back when you return your old part.`,
    quantity: qty(quantity),
    unitPrice: money(coreCharge),
    lineTotal: money(Number(coreCharge) * quantity),
  };
}

/** One parcel line as the item table reads it, with its refundable core deposit
 *  under it, the way the order's own item list prints them. */
export function parcelItemRows(
  quantity: number,
  line: {
    name: string | null;
    description: string | null;
    quantity: number;
    unitPrice: unknown;
    lineSubtotal: unknown;
    coreCharge: unknown;
  }
): Row[] {
  const name = firstText(line.name, line.description);
  const share = line.quantity > 0 ? quantity / line.quantity : 0;
  const part = {
    name,
    quantity: qty(quantity),
    unitPrice: money(line.unitPrice),
    lineTotal: money(Math.round(Number(line.lineSubtotal) * share * 100) / 100),
  };
  if (line.coreCharge === null || line.coreCharge === undefined) return [part];
  return [part, depositRow(name, quantity, line.coreCharge)];
}

/** One invoice line as the item table reads it: its name, and its core deposit
 *  under it when it carries one. `description` stays for an email a business
 *  wrote with it. */
export function invoiceItemRows(line: {
  description: string;
  quantity: unknown;
  unitPrice: unknown;
  lineSubtotal: unknown;
  coreCharge: unknown;
}): (Row & { description: string })[] {
  const part = {
    name: line.description,
    description: line.description,
    quantity: qty(line.quantity),
    unitPrice: money(line.unitPrice),
    lineTotal: money(line.lineSubtotal), // before tax, as the printed invoice shows it
  };
  if (line.coreCharge === null || line.coreCharge === undefined) return [part];
  const deposit = depositRow(line.description, Number(line.quantity), line.coreCharge);
  return [part, { ...deposit, description: deposit.name }];
}

/** The money that came in on an invoice, apart from what was taken off it. A
 *  returned core's credit took money off the bill and none came in, so "Total
 *  paid" never counts it (issue 185 drew the same line on the statement). */
export function invoiceMoneyIn(payments: readonly { kind: string; amount: unknown }[]): {
  paidCents: number;
  creditedCents: number;
} {
  let paidCents = 0;
  let creditedCents = 0;
  for (const payment of payments) {
    const cents = Math.round(Number(payment.amount) * 100);
    if (payment.kind === 'payment' || payment.kind === 'deposit') paidCents += cents;
    else if (payment.kind === 'refund') paidCents -= cents;
    else if (payment.kind === 'credit') creditedCents += cents;
  }
  return { paidCents, creditedCents };
}
