// Row shapes for the generic list surfaces.
//
// Each names ONLY the fields its columns read, so a wider API response can never
// quietly become a dependency of the UI.

export interface NamedRow {
  id: string;
  name?: string | null;
  title?: string | null;
  status?: string | null;
}

export interface CustomerRow extends NamedRow {
  email?: string | null;
  company?: string | null;
}

// Orders and PRODUCTS are no longer generic lists: each has its own surfaces
// (list + detail) with its own types and wire coercion — `surfaces/commerce/
// data.ts` owns the order shape for the whole app, and `surfaces/commerce/
// products-data.ts` owns the product + version shapes.
