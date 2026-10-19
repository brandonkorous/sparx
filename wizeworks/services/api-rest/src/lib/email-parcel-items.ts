// What is in one parcel, for the shipping email (sparx persona issue 358).
//
// The email printed the ORDER's lines under "Shipped". Renée's O-000008 went in
// two parcels and the email for one of them listed all six injectors.

import { firstText, money, qty } from './email-format.js';

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
): { name: string; quantity: string; unitPrice: string; lineTotal: string }[] {
  const name = firstText(line.name, line.description);
  const share = line.quantity > 0 ? quantity / line.quantity : 0;
  const part = {
    name,
    quantity: qty(quantity),
    unitPrice: money(line.unitPrice),
    lineTotal: money(Math.round(Number(line.lineSubtotal) * share * 100) / 100),
  };
  if (line.coreCharge === null || line.coreCharge === undefined) return [part];
  return [
    part,
    {
      name: `Refundable core deposit: ${name}. Paid back when you return your old part.`,
      quantity: qty(quantity),
      unitPrice: money(line.coreCharge),
      lineTotal: money(Number(line.coreCharge) * quantity),
    },
  ];
}
