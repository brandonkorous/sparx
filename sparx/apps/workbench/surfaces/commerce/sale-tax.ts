'use client';

// The sales tax on a sale at the counter (sparx persona issue 230).
//
// Take a sale charged none: Doty rang up a $299.95 camera and the till asked for
// $299.95, with Utah's 7.25% never added, while the website charged it on the
// same part collected at the same counter. The server works the tax out with
// checkout's own engine (`POST /v1/commerce/tax/sale-quote`); this file asks it,
// keeps the answer tied to the sale it was asked about, and names the row.

import { useMutation } from '@wizeworks/query';

import { api } from '../../lib/api/client';
import type { SaleLine } from './sale-data';

export interface SaleTaxQuote {
  totalTaxCents: number;
  /** The one rate charged (725 = 7.25%), or null when none or several were. */
  rateBasisPoints: number | null;
  lines: { ref: string; taxAmountCents: number }[];
  certificateOnFile: boolean;
}

/** The lines the tax is asked about: every line with a price, by its own id. A
 *  core deposit is not a price and is never sent. */
export function taxedLines(lines: readonly SaleLine[]) {
  return lines.flatMap((line) => {
    const price = Number(line.price);
    if (!Number.isFinite(price) || price < 0 || line.quantity < 1) return [];
    return [
      {
        ref: line.id,
        variantId: line.variantId,
        quantity: line.quantity,
        unitPriceCents: Math.round(price * 100),
      },
    ];
  });
}

/** The question as a string, so an answer can be matched to the sale it was
 *  asked about. A price typed after the question makes the answer stale. */
export function taxKey(customerId: string | null, lines: readonly SaleLine[]): string {
  const asked = taxedLines(lines)
    .map((l) => `${l.ref}:${String(l.variantId)}:${String(l.quantity)}:${String(l.unitPriceCents)}`)
    .join(',');
  return `${customerId ?? ''}|${asked}`;
}

/** Each line's tax in whole currency units, by line id. */
export function taxByLine(quote: SaleTaxQuote): Map<string, number> {
  return new Map(quote.lines.map((line) => [line.ref, line.taxAmountCents / 100]));
}

/** The totals row's name: the rate when there is one, or why there is none. */
export function taxRowLabel(quote: SaleTaxQuote | null): string {
  if (!quote) return 'Sales tax';
  if (quote.totalTaxCents === 0 && quote.certificateOnFile) {
    return 'Sales tax (none: their tax certificate is on file)';
  }
  if (quote.rateBasisPoints === null) return 'Sales tax';
  return `Sales tax (${String(quote.rateBasisPoints / 100)}%)`;
}

export function useSaleTax() {
  return useMutation({
    mutationFn: (input: { customerId: string | null; lines: readonly SaleLine[] }) =>
      api.post<SaleTaxQuote>('/v1/commerce/tax/sale-quote', {
        customerId: input.customerId,
        lines: taxedLines(input.lines),
      }),
  });
}
