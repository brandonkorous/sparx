// What returned units cost the buyer: one rule for the return form, the refund
// the shop is offered, and how the refund is split across the order's lines.
//
// It was the unit price times the units, everywhere. Brynn O'Hara-Løvdal sent
// back one of two injectors she paid $600.00 and $43.50 of Utah tax on, and the
// refund was worked out as $600.00: the tax she paid stayed with the shop. The
// same figure ignored a line's discount, so a discounted line was offered back
// at full price (sparx persona issue 231).

/** One order line's money, in cents: what its goods came to after their
 *  discount, and the sales tax on them. */
export interface PaidLine {
  quantity: number;
  goodsCents: number;
  taxCents: number;
}

/** An order line, in the currency units the order keeps (dollars). */
export function paidLine(item: {
  quantity: number | string;
  lineSubtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
}): PaidLine {
  const cents = (amount: number | string) => Math.round(Number(amount) * 100);
  return {
    quantity: Number(item.quantity),
    goodsCents: cents(item.lineSubtotal) - cents(item.discountAmount),
    taxCents: cents(item.taxAmount),
  };
}

/** What `units` of the line cost: its share of the goods and of the tax. Never
 *  more than the whole line. */
export function paidForUnits(
  line: PaidLine,
  units: number
): { goodsCents: number; taxCents: number } {
  if (units <= 0 || line.quantity <= 0) return { goodsCents: 0, taxCents: 0 };
  const share = Math.min(units, line.quantity) / line.quantity;
  return {
    goodsCents: Math.round(line.goodsCents * share),
    taxCents: Math.round(line.taxCents * share),
  };
}
