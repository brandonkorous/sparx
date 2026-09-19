// HOW AN ITEM IS NAMED ON A SCREEN, in one place.
//
// ── The problem this exists to stop ──────────────────────────────────────────
//
// `ProductVariant.title` is nullable and the schema calls it "computed from
// options when omitted" — but nothing computes it on write, so it is simply
// absent for a third of the catalogue. MEASURED 2026-09-18 on the local
// database: 2,548 variants, 1,670 with a title, so 878 have none.
//
// Six inventory services send the console a `variantName`. Five of them filled
// it from `v.title` alone, which fails twice over and in opposite directions:
//
//   title is NULL   →  the pane falls back to the code, and the codes on an
//                      imported catalogue look like `6a2e25d8be63…:18544`
//   title is SET    →  it reads "White / 2XL", which names a SIZE, not a thing.
//                      Fifteen rows of it and the only way to tell a shirt from
//                      a mug is the code beside it.
//
// Neither ever prints the one word a person recognises: the PRODUCT. A shop
// owner looking at her own preorders should read "Linen Shirtdress", not
// "LINEN-SHIRTD-L-CHALK" and not "Chalk / L".
//
// `uncostedStock` solved this correctly and alone, with the lateral join below
// and a three-line cell (product, version, code). This module is that answer
// lifted out of it so the other five stop reinventing it wrongly. Issue 681.
//
// ── The shape ────────────────────────────────────────────────────────────────
//
// TWO fields, never one. `productTitle` is what the thing IS and `variantName`
// is which one of them — a row needs both, because the product alone cannot
// tell two sizes apart and the version alone does not say what it is a version
// of. A caller that squashes them into a single string is the bug coming back.

import { Prisma } from '@wizeworks/db';

/**
 * The two naming columns, for a raw query.
 *
 * Requires `VARIANT_LABEL_JOINS` in the same query, and requires the variant to
 * be aliased `v` — which every query using this already does.
 */
export const VARIANT_LABEL_COLUMNS = Prisma.sql`
             p.title                        AS "productTitle",
             COALESCE(v.title, opts.label)  AS "variantName"
`;

/**
 * The joins those two columns need.
 *
 * The lateral rebuilds the option label the same way the catalogue displays it —
 * by the option's own position, then the value's — so "Chalk / L" comes out in
 * the order the shop set up rather than alphabetically.
 */
export const VARIANT_LABEL_JOINS = Prisma.sql`
        LEFT JOIN commerce_products p ON p.id = v.product_id
        LEFT JOIN LATERAL (
          SELECT string_agg(ov.value, ' / ' ORDER BY o.position, ov.position) AS label
            FROM commerce_product_variant_option_values vov
            JOIN commerce_product_option_values ov ON ov.id = vov.option_value_id
            JOIN commerce_product_options o        ON o.id = ov.option_id
           WHERE vov.variant_id = v.id
        ) opts ON TRUE
`;

/** The same two fields for a Prisma `select` on a `variant` relation. */
export const VARIANT_LABEL_SELECT = {
  sku: true,
  title: true,
  product: { select: { title: true } },
  optionAssignments: {
    select: {
      optionValue: {
        select: { value: true, position: true, option: { select: { position: true } } },
      },
    },
  },
} as const;

export interface LabelledVariant {
  sku?: string | null;
  title: string | null;
  product?: { title: string } | null;
  optionAssignments?: {
    optionValue: { value: string; position: number; option: { position: number } };
  }[];
}

/**
 * What a variant is called, from a Prisma row selected with
 * `VARIANT_LABEL_SELECT`. The same answers the SQL above produces.
 *
 * Returns all three parts together on purpose: the code travels with the two
 * names because a caller that takes only some of them is how a pane ends up
 * with a code and no name again.
 */
export function variantLabel(variant: LabelledVariant | null | undefined): {
  variantSku: string | null;
  productTitle: string | null;
  variantName: string | null;
} {
  if (!variant) return { variantSku: null, productTitle: null, variantName: null };
  const options = [...(variant.optionAssignments ?? [])]
    .sort(
      (a, b) =>
        a.optionValue.option.position - b.optionValue.option.position ||
        a.optionValue.position - b.optionValue.position
    )
    .map((assignment) => assignment.optionValue.value)
    .join(' / ');
  return {
    variantSku: variant.sku ?? null,
    productTitle: variant.product?.title ?? null,
    // Empty string is not a name. A product with one unnamed version has no
    // options and no title, and the cell should show nothing rather than a gap
    // where a version used to be.
    variantName: variant.title ?? (options === '' ? null : options),
  };
}
