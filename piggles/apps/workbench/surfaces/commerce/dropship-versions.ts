// One code and one price per version, for a supplier who ships a product that
// comes in more than one (sparx persona issue 362).
//
// The form asked for one code and one price for the whole product. S&B's cold
// air intake comes as 75-5094 and 75-5094D, so a buyer of one had S&B emailed
// the other's code. With more than one version, each gets its own row.

import type { ProductDropshipVariant } from './products-data';

export interface VersionRow {
  variantId: string;
  /** What the owner calls this version: its name, else its SKU. */
  label: string;
  code: string;
  cost: string;
}

function centsToTyped(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

/** The rows the form starts with: the code the supplier was given for each
 *  version, else the version's own SKU; its cost, else the product's price
 *  from them. */
export function startingRows(
  variants: readonly ProductDropshipVariant[],
  linkCostCents: number | null
): VersionRow[] {
  return variants.map((variant) => ({
    variantId: variant.id,
    label: variant.title ?? variant.sku,
    code: variant.supplierSku ?? variant.sku,
    cost: centsToTyped(variant.costCents ?? linkCostCents),
  }));
}

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Dollars typed in a box, as cents; null when it is not an amount. */
export function typedCents(typed: string): number | null {
  const value = typed.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!MONEY.test(value)) return null;
  return Math.round(Number(value) * 100);
}

/** What to send, or the first thing missing, in the form's words. */
export function versionsToSend(
  rows: readonly VersionRow[]
):
  | { versions: { variantId: string; supplierSku: string; costCents: number }[] }
  | { problem: string } {
  const versions: { variantId: string; supplierSku: string; costCents: number }[] = [];
  for (const row of rows) {
    if (row.code.trim() === '') return { problem: `Give their code for ${row.label}.` };
    const costCents = typedCents(row.cost);
    if (costCents === null) {
      return { problem: `Say what they charge you for ${row.label}, like 250.00.` };
    }
    versions.push({ variantId: row.variantId, supplierSku: row.code.trim(), costCents });
  }
  return { versions };
}
