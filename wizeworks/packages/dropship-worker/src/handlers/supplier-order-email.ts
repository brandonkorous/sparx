// The order a business's own supplier gets by email (sparx persona issue 171).
//
// A maker or wholesaler who ships when sent the order has no system to call, so
// the order goes to them the way a stock purchase order already does: the
// `purchase-order-sent` email, from the business, with every line, at what the
// supplier charges, and with the business's CUSTOMER as the ship-to.
//
// Two things stop it going, and each leaves the order waiting for the owner
// rather than sending something wrong:
//   - No cost for a line. The customer's price is never put in its place: the
//     supplier would read what the business charges and be asked to supply at it.
//   - No address. An order to be collected, or one that lost its address, has
//     nowhere for a parcel to go.

import type { ShippingAddress } from '@wizeworks/dropship';

export interface SupplierOrderLine {
  /** The product as the business sells it. */
  title: string;
  /** The supplier's code for it: what they pick by. */
  supplierSku: string;
  quantity: number;
  /** What the supplier charges the business for one. Null when nobody set it. */
  unitCostCents: number | null;
}

export interface SupplierOrderEmailInput {
  fromName: string;
  supplierName: string;
  contactName: string | null;
  orderNumber: string;
  currency: string;
  shipTo: ShippingAddress;
  lines: SupplierOrderLine[];
  /** What the customer wrote at checkout ("Anything we should know? Where to
   *  leave it…"). The supplier is the one leaving it. */
  customerNote?: string | null;
}

/** The `purchase-order-sent` props, as `@wizeworks/email` takes them. */
export interface SupplierOrderEmailProps {
  fromName: string;
  supplierName: string;
  contactName: string | null;
  documentNumber: string;
  total: number;
  currency: string;
  expectedBy: null;
  shipTo: { name: string; lines: string[] };
  reference: null;
  paymentTerms: null;
  lines: { title: string; subtitle: string; amount: string }[];
  summary: { label: string; value: string }[];
  note: string | null;
  shipsToCustomer: true;
}

export type SupplierOrderEmail =
  { ok: true; props: SupplierOrderEmailProps } | { ok: false; reason: string };

function money(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** The address as a carrier reads it, a line each; the phone too, because a
 *  freight carrier rings ahead before it delivers a large part. */
function addressLines(address: ShippingAddress): string[] {
  const regionPostal = [address.region, address.postalCode].filter(Boolean).join(' ');
  const cityLine = [address.city, regionPostal].filter((part) => part.trim() !== '').join(', ');
  return [
    address.company && address.company !== address.name ? address.company : '',
    address.line1,
    address.line2 ?? '',
    cityLine,
    address.countryCode,
    address.phone ? `Phone ${address.phone}` : '',
  ]
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function customerAsked(note: string | null | undefined): string | null {
  const said = note?.trim() ?? '';
  return said === '' ? null : `Our customer asked: “${said}”`;
}

export function supplierOrderEmail(input: SupplierOrderEmailInput): SupplierOrderEmail {
  if (input.shipTo.line1.trim() === '') {
    return {
      ok: false,
      reason: `This order has no address to ship to, so it was not sent to ${input.supplierName}. Send it to them yourself, then record it here as placed.`,
    };
  }

  const unpriced = input.lines.find((line) => line.unitCostCents === null);
  if (unpriced) {
    return {
      ok: false,
      reason: `What ${input.supplierName} charges you for ${unpriced.title} is not set, so the order was not sent. Set it on the product, then send this order to them yourself and record it here as placed.`,
    };
  }

  let totalCents = 0;
  const lines = input.lines.map((line) => {
    const unit = line.unitCostCents ?? 0;
    const lineCents = unit * line.quantity;
    totalCents += lineCents;
    return {
      title: line.title,
      subtitle: `their code ${line.supplierSku} · ${String(line.quantity)} × ${money(unit, input.currency)}`,
      amount: money(lineCents, input.currency),
    };
  });

  return {
    ok: true,
    props: {
      fromName: input.fromName,
      supplierName: input.supplierName,
      contactName: input.contactName,
      documentNumber: input.orderNumber,
      total: totalCents / 100,
      currency: input.currency,
      expectedBy: null,
      shipTo: { name: input.shipTo.name, lines: addressLines(input.shipTo) },
      reference: null,
      paymentTerms: null,
      lines,
      summary: [{ label: 'Subtotal', value: money(totalCents, input.currency) }],
      note: customerAsked(input.customerNote),
      shipsToCustomer: true,
    },
  };
}
