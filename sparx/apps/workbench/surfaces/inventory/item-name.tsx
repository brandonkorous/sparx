'use client';

// WHAT AN ITEM IS CALLED, on every stock list that names one.
//
// Three parts and they are not interchangeable:
//
//   Linen Shirtdress                  the product — what a person recognises
//   Chalk / L · LINEN-SHIRTD-L        which one of them, then the code
//
// Five lists used to print `variantName ?? variantSku` and nothing else, which
// showed a shop owner either "Chalk / L" (a size, on a row that never says a
// size of WHAT) or a raw code, depending on whether that variant happened to
// have a title. A third of them do not have one. Issue 681; the server half is
// `wizeworks/packages/inventory/src/services/variant-label.ts`.
//
// The product name WRAPS where the other two truncate, which is the lesson
// `uncosted-row.tsx` learned first: in a narrow pane every row read "Linen
// Shir…" and told her nothing, while a size is short enough to survive and a
// code is a reference rather than something she reads.

export function ItemName({
  productTitle,
  variantName,
  code,
  fallback = 'Unnamed item',
  wrapCode = false,
}: {
  /** The product. Null on a row whose product has been deleted. */
  productTitle: string | null;
  /** Which version — "Chalk / L". Null for a product with one unnamed version,
   *  where a second line would just repeat the first. */
  variantName: string | null;
  /** The SKU, or whatever code this list identifies a row by. */
  code: string | null;
  fallback?: string;
  /** Let the code wrap onto a second line rather than truncate.
   *
   *  For a list where the code is the thing being typed against, not a
   *  reference: a code is distinguished by its TAIL, so a clipped
   *  ASH-OVERSHIRT-L-INK is not a shortened name, it is ASH-OVERSHIRT-XL-MOSS's
   *  name. The bulk-edit grid turns this on for that reason. */
  wrapCode?: boolean;
}) {
  const title = productTitle ?? variantName ?? code ?? fallback;
  // Only when the line above is the PRODUCT. When the product name is missing
  // the version has already been promoted into it, and repeating it underneath
  // would be the same string twice.
  const version = productTitle ? variantName : null;
  const showCode = code !== null && code !== title;

  return (
    <>
      <span className="font-medium break-words">{title}</span>
      {version || showCode ? (
        <span className={wrapCode ? 'text-sm' : 'truncate text-sm'}>
          {version}
          {version && showCode ? ' · ' : ''}
          {showCode ? (
            <span className={wrapCode ? 'font-mono break-all' : 'font-mono'}>{code}</span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

/** The same name on one line, for a dialog title or a sentence. */
export function itemNameText(
  item: { productTitle: string | null; variantName: string | null; variantSku?: string | null },
  fallback: string
): string {
  return item.productTitle ?? item.variantName ?? item.variantSku ?? fallback;
}
