// Prices on a wholesale quote request (sparx persona issue 086).
//
// A request the buyer sends starts each catalog line at the ACCOUNT's price,
// worked out by the same engine checkout and the console quote editor use, so
// the business opens it ready to work from (issue 077 did this for quotes typed
// in the console). Those figures are the business's working copy until it has
// made the offer: the buyer's portal sends no money for a quote before then.

import type { b2bQuoteRequestService } from '@wizeworks/crm';
import type { pricingService, ServiceContext } from '@wizeworks/commerce';

type ResolveForAccount = typeof pricingService.resolveForAccount;

/** The account's price for a requested line, from the commerce price engine,
 *  with the sentence the console editor keeps as the line's price note. */
export function accountPricer(
  ctx: ServiceContext,
  resolveForAccount: (
    ctx: ServiceContext,
    input: Parameters<ResolveForAccount>[1]
  ) => Promise<{ effectivePriceCents: number; words: string | null }>
): b2bQuoteRequestService.AccountPricer {
  return async ({ variantId, accountId, quantity, propertyId }) => {
    const price = await resolveForAccount(ctx, {
      variantId,
      accountId,
      quantity,
      ...(propertyId ? { propertyId } : {}),
    });
    return { unitPrice: price.effectivePriceCents / 100, priceNote: price.words };
  };
}

/**
 * Whether the buyer may see a quote's prices. Not while the business is still
 * working on it (Draft, Submitted, Under Review); yes once it is Quoted and after
 * it is accepted. A declined or expired quote shows them only if the offer was
 * sent; otherwise they are still the business's unsent figures.
 */
export function quotePricesShown(
  stage: { name: string; stageType: string },
  metadata: unknown
): boolean {
  if (stage.stageType === 'draft') return stage.name === 'Quoted';
  if (stage.stageType === 'void') {
    const sentAt =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>).sentAt
        : undefined;
    return typeof sentAt === 'string' && sentAt !== '';
  }
  return true;
}

interface QuoteMoney<T, L> {
  totalCents: number;
  totals: T;
  lines: (L & {
    unitPriceCents: number;
    lineSubtotalCents: number;
    lineTotalCents: number;
    coreDepositCents: number | null;
  })[];
}

/** A quote's money for the portal: all of it, or none of it. */
export function portalQuoteMoney<T, L>(
  row: QuoteMoney<T, L>,
  shown: boolean
): {
  totalCents: number | null;
  totals: T | null;
  lines: (L & {
    unitPriceCents: number | null;
    lineSubtotalCents: number | null;
    lineTotalCents: number | null;
    coreDepositCents: number | null;
  })[];
} {
  if (shown) return row;
  return {
    totalCents: null,
    totals: null,
    lines: row.lines.map((l) => ({
      ...l,
      unitPriceCents: null,
      lineSubtotalCents: null,
      lineTotalCents: null,
      coreDepositCents: null,
    })),
  };
}

/**
 * Whether the buyer may print a document on their account: an issued bill
 * always (the caller has already narrowed to those), a quote only once the
 * offer is made, by the same rule as the quotes list. The old rule refused
 * every `draft`-type stage, which included Quoted, so a priced quote's "Print
 * or save as PDF" led nowhere, and it allowed a declined quote the business
 * never sent (sparx persona issue 086).
 */
export function portalDocumentPrintable(doc: {
  isQuote: boolean;
  stage: { name: string; stageType: string };
  metadata: unknown;
}): boolean {
  return doc.isQuote ? quotePricesShown(doc.stage, doc.metadata) : true;
}
