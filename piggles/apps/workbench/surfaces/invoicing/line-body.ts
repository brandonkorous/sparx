// What one line write sends, and whether a line changed enough to send it.
// Split out of save.ts, which owns the document save around it.

import { withPriceNote, withProductLabel } from './line-price-note';
import { lineCostCents } from './line-margin';
import type { DraftLine } from './totals';

/** The line's stored bag after this save, or nothing to send. A line no longer
 *  linked to a product keeps no product name (sparx persona issue 085). */
export function lineMetadata(line: DraftLine): { metadata?: Record<string, unknown> } {
  if (line.priceNote === undefined && line.productLabel === undefined) return {};
  let metadata: Record<string, unknown> = { ...(line.metadata ?? {}) };
  if (line.priceNote !== undefined) metadata = withPriceNote(metadata, line.priceNote);
  if (line.productLabel !== undefined) {
    metadata = withProductLabel(metadata, line.productId ? line.productLabel : null);
  }
  return { metadata };
}

// A markup line sends its cost + directive and NEVER a unitPrice: the server
// prices it. A manual line sends its typed price and its cost.
export function lineBody(line: DraftLine): Record<string, unknown> {
  const common = {
    ...(line.lineTypeId ? { lineTypeId: line.lineTypeId } : {}),
    description: line.description.trim(),
    quantity: line.quantity,
    discountAmount: line.discountAmount,
    taxable: line.taxable,
    productId: line.productId ?? null,
    variantId: line.variantId ?? null,
    // Sent only when said: left out, the server takes the part's own deposit.
    ...(line.coreCharge !== undefined ? { coreCharge: line.coreCharge } : {}),
    // Where the price came from, and which product the line draws from, merged
    // into the line's stored bag. Left out when neither was said, so a save
    // never wipes what it did not read.
    ...lineMetadata(line),
  };

  if (line.markup) {
    return {
      ...common,
      ...(line.explicitCostCents != null ? { explicitCostCents: line.explicitCostCents } : {}),
      markup: line.markup,
    };
  }

  // Cost every time, null when cleared: the server keeps what it was last told,
  // and the margin is worked out from it (sparx persona issue 086).
  return { ...common, unitPrice: line.unitPrice, explicitCostCents: lineCostCents(line) };
}

export function lineChanged(line: DraftLine, previous: DraftLine): boolean {
  return (
    line.description !== previous.description ||
    line.quantity !== previous.quantity ||
    line.unitPrice !== previous.unitPrice ||
    line.discountAmount !== previous.discountAmount ||
    line.taxable !== previous.taxable ||
    (line.lineTypeId ?? null) !== (previous.lineTypeId ?? null) ||
    (line.productId ?? null) !== (previous.productId ?? null) ||
    (line.variantId ?? null) !== (previous.variantId ?? null) ||
    // The cost in effect, typed or stored (sparx persona issue 086).
    lineCostCents(line) !== lineCostCents(previous) ||
    (line.coreCharge ?? null) !== (previous.coreCharge ?? null) ||
    (line.priceNote ?? null) !== (previous.priceNote ?? null) ||
    (line.productLabel ?? null) !== (previous.productLabel ?? null) ||
    // A markup directive is a fresh object each edit; re-send whenever one is
    // present (the server re-prices) rather than deep-comparing the union.
    line.markup != null
  );
}
