// What the goods chosen on the return form are worth (sparx persona issue 211).
// The figure the shop starts from when it gives the money back: what she paid
// for each, sales tax included, plus the core deposit on a rebuilt part that
// still owed its old part (a part that comes back is its own core, issue 051).
// The shop decides the refund, so the sentence says so.
//
// What she paid is her share of the line after its discount, and of the tax on
// it. It was the unit price alone: one injector of two read "$600.00" to a buyer
// who had paid $643.50 for it (sparx persona issue 231). `paidForUnits` is the
// one rule, shared with the shop's refund and the server.

import { paidForUnits } from '@wizeworks/commerce-schemas';

import { formatMoney } from './format';

export interface ReturnValueLine {
  orderItemId: string;
  /** How many were bought on the line. */
  quantity: number;
  /** The whole line's goods after their discount, and the sales tax on them. */
  goodsPaidCents: number;
  taxPaidCents: number;
  /** The core deposit on one unit; null when the part carries none. */
  coreDepositCents: number | null;
  /** How many units still owe their old part, so bring their deposit back. */
  coresOwed: number;
}

export interface ReturnValue {
  goodsCents: number;
  taxCents: number;
  coreCents: number;
}

/** What she paid and the core deposits, for the quantities she chose. */
export function returnValueOf(
  lines: readonly ReturnValueLine[],
  chosen: Readonly<Record<string, number>>
): ReturnValue {
  const value: ReturnValue = { goodsCents: 0, taxCents: 0, coreCents: 0 };
  for (const line of lines) {
    const quantity = chosen[line.orderItemId] ?? 0;
    if (quantity <= 0) continue;
    const paid = paidForUnits(
      { quantity: line.quantity, goodsCents: line.goodsPaidCents, taxCents: line.taxPaidCents },
      quantity
    );
    value.goodsCents += paid.goodsCents;
    value.taxCents += paid.taxCents;
    if (line.coreDepositCents !== null) {
      value.coreCents += Math.min(quantity, line.coresOwed) * line.coreDepositCents;
    }
  }
  return value;
}

/** "At the price you paid, this comes to $4.32. We tell you what we give back
 *  once we have looked at it." Null before anything is chosen. */
export function returnValueSentence(value: ReturnValue, currency: string): string | null {
  if (value.goodsCents <= 0) return null;
  const paid = formatMoney(value.goodsCents + value.taxCents, currency);
  const opening =
    value.taxCents > 0
      ? `At the price you paid, with its sales tax, this comes to ${paid}`
      : `At the price you paid, this comes to ${paid}`;
  const core =
    value.coreCents > 0
      ? `, and ${formatMoney(value.coreCents, currency)} of core deposit comes back with it`
      : '';
  return `${opening}${core}. We tell you what we give back once we have looked at it.`;
}
