// Canonical browse-query form for the public marketplace (docs/60 §8/§9).
//
// A facet selection is a SET, but a URL is a string — so the same logical query
// has many spellings: `?mood=Bold,Calm` and `?mood=Calm,Bold` differ only in the
// order values happened to be clicked, and `?mood=X&industry=Y` differs from
// `?industry=Y&mood=X` only in key order. Left alone, those spellings multiply
// factorially, and because both the page (`revalidate`) and the data layer
// (`next: { revalidate }`) key their cache on the full URL, every spelling is a
// guaranteed cache MISS that reaches api-rest for real. A crawler following facet
// links walks that space forever — which is exactly what took api-rest down on
// 2026-07-16 (V8 heap exhaustion under a flood of `?mood=<permutation>` reads).
//
// So: one logical query, one URL. Facet values are de-duped + sorted, keys are
// sorted, and the browse page redirects any non-canonical spelling to this form.
// That collapses the URL space from permutations to combinations and lets the
// cache actually do its job. Canonicalization is idempotent — canonical(canonical(x))
// === canonical(x) — which is what makes the redirect safe from loops.

import { getCategory } from './marketplace-registry';

/** The browse params that survive a facet toggle (everything but paging). */
export type BrowseParams = Record<string, string>;

/** Split a comma-separated facet value into de-duped, sorted tokens. */
export function parseFacetList(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const token of value.split(',')) {
    const trimmed = token.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * The canonical spelling of `params` for `categoryId`: every facet key's value
 * de-duped + sorted, every key in sorted order, empties dropped. Non-facet keys
 * (`q`, `sort`, `cursor`, `limit`) pass through untouched — sorting a free-text
 * `q` would corrupt it.
 */
export function canonicalizeParams(categoryId: string, params: BrowseParams): BrowseParams {
  const facetKeys = new Set((getCategory(categoryId)?.facets ?? []).map((f) => f.key));
  const out: BrowseParams = {};
  for (const key of Object.keys(params).sort()) {
    const raw = params[key];
    if (!raw) continue;
    if (!facetKeys.has(key)) {
      out[key] = raw;
      continue;
    }
    const list = parseFacetList(raw);
    if (list.length) out[key] = list.join(',');
  }
  return out;
}

/** Canonical query string for `params` ('' when empty), stable across spellings. */
export function canonicalQueryString(categoryId: string, params: BrowseParams): string {
  return new URLSearchParams(canonicalizeParams(categoryId, params)).toString();
}
