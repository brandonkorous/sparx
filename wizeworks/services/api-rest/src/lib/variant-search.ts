// Finding one version of one product in a catalog of any size.
//
// The variant catalog endpoint had no search term of its own, so every picker
// over it (the till, the bundle and price list pickers, returns, repeat orders)
// pulled the first 500 versions ordered by product title and filtered them in
// the browser. A parts counter with 693 versions could never find anything
// after roughly the 500th alphabetically: a part on the shelf, sold every week,
// and the till said "nothing you sell matches" (sparx persona P01, issue 069).
//
// The rule matches what the pickers already did by hand, now asked of the
// database: split what was typed into words, and every word must land on the
// product's name, the version's code, the version's own name, or one of its
// option values ("6.7L", "Stage 1", "M", "Moss"). The option values are the
// part that matters most, because on most catalogs the version has no name of
// its own and the options ARE how a person says which one they mean.
//
// WORDS, NOT A SUBSTRING, for the same reason as the contact search: "injector
// 6.7" has the product's name in one word and an option in the other, and
// nobody types a catalog string in catalog order. `nameSearchClauses` owns the
// "every word, somewhere" part; this owns which columns "somewhere" is.

import { nameSearchClauses, productSiteVisibilityWhere } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

/** The places one typed word may match on a version, case-insensitively. */
export function variantWordClauses(term: string): Prisma.ProductVariantWhereInput[] {
  return [
    { product: { title: { contains: term, mode: 'insensitive' } } },
    { sku: { contains: term, mode: 'insensitive' } },
    { title: { contains: term, mode: 'insensitive' } },
    {
      optionAssignments: {
        some: { optionValue: { value: { contains: term, mode: 'insensitive' } } },
      },
    },
  ];
}

/**
 * `AND` entries for a variant search: one `OR` group per typed word.
 *
 * Returns entries to SPREAD into the `where`'s own `AND` array, never an object
 * to merge, so it cannot collide with the site scope's `product` clause. An
 * empty or missing search returns `[]` and adds nothing.
 */
export function variantSearchClauses(
  q: string | null | undefined
): Prisma.ProductVariantWhereInput[] {
  return nameSearchClauses(q, variantWordClauses);
}

export interface VariantCatalogFilter {
  /** Archived versions too. Off by default: nothing retired belongs in a picker. */
  includeArchived: boolean;
  /** The site asking, or undefined for the whole tenant (see `resolveListScope`). */
  propertyId: string | undefined;
  /** What was typed. Empty or missing means "the first window", unfiltered. */
  q?: string | null;
  /** Only this product's versions: what a picker floats to the top. */
  productId?: string | null;
}

/**
 * The whole `where` for `GET /v1/commerce/variants`.
 *
 * One function, so the search can never be added in a way that loses the site
 * scope: a till that searched the whole TENANT would put one business's stock
 * on another one's counter, which is the defect the scope was added for on
 * 2026-09-17. The scope rides the `product` key and the search rides `AND`, so
 * the two compose instead of one replacing the other.
 */
export function variantCatalogWhere(filter: VariantCatalogFilter): Prisma.ProductVariantWhereInput {
  const search = variantSearchClauses(filter.q);
  return {
    ...(filter.includeArchived ? {} : { deletedAt: null }),
    ...(filter.productId ? { productId: filter.productId } : {}),
    // The same clause the products list filters on, so the two screens agree by
    // construction rather than by coincidence. A product with no site rows is
    // global and belongs to every counter.
    ...(filter.propertyId === undefined
      ? {}
      : { product: productSiteVisibilityWhere(filter.propertyId) }),
    ...(search.length > 0 ? { AND: search } : {}),
  };
}
