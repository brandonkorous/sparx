// Where a line's price came from, kept with the line.
//
// A quote line priced at a wholesale account's own price says so on the line:
// "Fleet price: 12% off $600.00" (sparx persona issue 077). The sentence is the
// server's (`/v1/b2b/resolve-price`); it is stored in the line's metadata bag as
// `priceNote`, so a quote reopened next week still says why $528.00 is not
// $600.00, and the order made from it carries the same words.

/** The note on a stored line, or null for none. */
export function priceNoteOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).priceNote;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** The line's metadata with the note set, or removed when there is none.
 *  MERGED: whatever else the bag holds stays. */
export function withPriceNote(
  metadata: Record<string, unknown> | null | undefined,
  note: string | null
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) };
  if (note === null || note.trim() === '') {
    delete base.priceNote;
    return base;
  }
  return { ...base, priceNote: note };
}

// ── WHICH PRODUCT THE LINE DRAWS FROM, BY NAME ──────────────────────────────
//
// A line picked from the catalog says which product it is, even after its
// description is changed. The name was held only in the editor's memory, so a
// quote reopened later carried a bare "Linked product" badge on every such line
// (sparx persona issue 085). It is kept in the same bag as the price note.

/** The product name stored on a line, or null for none. */
export function productLabelOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).productLabel;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** The line's metadata with the product name set, or removed when there is
 *  none. MERGED: whatever else the bag holds stays. */
export function withProductLabel(
  metadata: Record<string, unknown> | null | undefined,
  label: string | null
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) };
  if (label === null || label.trim() === '') {
    delete base.productLabel;
    return base;
  }
  return { ...base, productLabel: label };
}
