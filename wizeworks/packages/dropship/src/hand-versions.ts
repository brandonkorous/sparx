// The versions of a product a supplier ships by hand-made link, each with the
// supplier's own code and price (sparx persona issue 362).
//
// A supplier with no product list is pointed at a product by the owner, who
// says their code for it and what they charge. That was one code and one price
// for the whole product. Gillett's S&B Cold Air Intake comes as 75-5094 (oiled)
// and 75-5094D (dry): a buyer of the dry one had S&B emailed "their code
// 75-5094", the other part, at the one price.
//
// Each version's code and price are kept on the supplier's item, in the same
// `variants` list an imported product keeps its supplier versions in, with
// `variantId` naming which of OUR versions each one is.

import type { NormalizedProductVariant } from './types.js';

/** One of our versions, as a hand-linked supplier knows it. */
export interface HandVersion {
  variantId: string;
  supplierSku: string;
  costPriceCents: number;
}

/** The hand-made versions on a supplier's item; empty when it has none (an
 *  imported item, or one linked with a single code for the whole product). */
export function handVersionsOf(variants: unknown): HandVersion[] {
  if (!Array.isArray(variants)) return [];
  const out: HandVersion[] = [];
  for (const entry of variants as unknown[]) {
    if (entry === null || typeof entry !== 'object') continue;
    const v = entry as Record<string, unknown>;
    if (typeof v.variantId !== 'string' || typeof v.supplierSku !== 'string') continue;
    if (typeof v.costPriceCents !== 'number') continue;
    out.push({
      variantId: v.variantId,
      supplierSku: v.supplierSku,
      costPriceCents: v.costPriceCents,
    });
  }
  return out;
}

/** The versions as the supplier's item stores them. */
export function handVersionsToStore(
  versions: readonly HandVersion[],
  titleOf: (variantId: string) => string
): (NormalizedProductVariant & { variantId: string })[] {
  return versions.map((version) => ({
    variantId: version.variantId,
    supplierSku: version.supplierSku,
    title: titleOf(version.variantId),
    options: {},
    costPriceCents: version.costPriceCents,
    msrpCents: null,
    inventoryQuantity: null,
    weight: null,
    imageUrls: [],
  }));
}

/** The code and price to send a hand-linked supplier for one order line: the
 *  line's own version when the item names it, else the product's one code and
 *  price, else the line's own SKU and cost. */
export function supplierLineFor(
  line: { variantId: string | null; sku: string; costCents: number | null },
  link:
    { supplierSku: string; costPriceCents: number; versions: readonly HandVersion[] } | undefined
): { supplierSku: string; unitCostCents: number | null } {
  const version = link?.versions.find((candidate) => candidate.variantId === line.variantId);
  if (version) return { supplierSku: version.supplierSku, unitCostCents: version.costPriceCents };
  if (link) return { supplierSku: link.supplierSku, unitCostCents: link.costPriceCents };
  return { supplierSku: line.sku, unitCostCents: line.costCents };
}
