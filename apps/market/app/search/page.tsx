// Search route. The PLP (/products) already faceted-searches on `?q=`, so /search
// is a thin canonical redirect into it — there's one product-search surface, not
// two. Preserves the query (and any other facet params a caller passed). A bare
// /search with no query lands on the full catalog.

import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    params.set(key, Array.isArray(value) ? (value[0] ?? '') : value);
  }
  const qs = params.toString();
  redirect(qs ? `/products?${qs}` : '/products');
}
