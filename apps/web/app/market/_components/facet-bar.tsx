// The browse facet controls (docs/60 §8/§9). Rendered as a responsive top filter
// bar: one chip group per registry facet, each value a toggle LINK carrying a
// count from the API's facet buckets. Pure SSR — toggling a facet is a navigation
// (no client state), which keeps the browse page indexable and the URL shareable.
// Faceting algebra (OR within a key, AND across keys, counts excluding own
// selection) lives in the catalog service; this only renders + links.
//
// At today's facet density (blueprints: 2 small groups) a wrapping chip bar reads
// better than a sidebar and collapses for free. As categories add denser facets,
// this is where a left rail / mobile Filters sheet (§13) would slot in.

import type { MarketplaceCategory } from '@/lib/marketplace-registry';
import type { MarketplaceFacetBucket } from '@/lib/marketplace';
import { canonicalQueryString, parseFacetList, type BrowseParams } from '@/lib/browse-params';

export type { BrowseParams };

/** Build a `/market/:cat?…` href from the current params with one key replaced
 *  (or removed when the new list is empty). Paging never carries across.
 *
 *  The href is CANONICAL (sorted keys + sorted facet values), so toggling the
 *  same facets in a different order lands on the same URL rather than minting a
 *  fresh one — see lib/browse-params for why that matters. */
function hrefWith(categoryId: string, current: BrowseParams, key: string, list: string[]): string {
  const next: BrowseParams = { ...current };
  if (list.length) next[key] = list.join(',');
  else delete next[key];
  delete next.cursor;
  const qs = canonicalQueryString(categoryId, next);
  return `/market/${categoryId}${qs ? `?${qs}` : ''}`;
}

export function FacetBar({
  category,
  facetCounts,
  current,
}: {
  category: MarketplaceCategory;
  facetCounts: Record<string, MarketplaceFacetBucket>;
  current: BrowseParams;
}) {
  const anySelected = category.facets.some((f) => parseFacetList(current[f.key]).length > 0);
  if (category.facets.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {category.facets.map((facet) => {
        const counts = facetCounts[facet.key] ?? {};
        const selected = parseFacetList(current[facet.key]);
        // Stable order: by count desc, then name. Hide values with no matches.
        const values = Object.keys(counts)
          .filter((v) => counts[v]! > 0 || selected.includes(v))
          .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));
        if (values.length === 0) return null;

        return (
          <div key={facet.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '12px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {facet.label}
            </span>
            <div className="mkt-cluster" style={{ gap: '8px' }}>
              {values.map((value) => {
                const isOn = selected.includes(value);
                const nextList = isOn ? selected.filter((v) => v !== value) : [...selected, value];
                return (
                  <a
                    key={value}
                    href={hrefWith(category.id, current, facet.key, nextList)}
                    // Canonical hrefs collapse permutations to combinations, but 2^n
                    // combinations is still a space no crawler should walk — the
                    // catalog's real content is reachable from the unfiltered page and
                    // the sitemap. Filtering is for humans; nofollow says so.
                    rel="nofollow"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 11px',
                      borderRadius: '9999px',
                      border: '1px solid',
                      borderColor: isOn ? category.accent : 'var(--color-base-300)',
                      backgroundColor: isOn
                        ? `color-mix(in srgb, ${category.accent} 12%, transparent)`
                        : 'var(--color-base-100)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: isOn ? 500 : 400,
                      color: isOn
                        ? category.accent
                        : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                      textDecoration: 'none',
                    }}
                  >
                    {value}
                    <span
                      style={{
                        color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                        fontWeight: 400,
                      }}
                    >
                      {counts[value] ?? 0}
                    </span>
                    {isOn ? <span aria-hidden>×</span> : null}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}

      {anySelected ? (
        <a
          href={`/market/${category.id}`}
          style={{
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            textDecoration: 'underline',
          }}
        >
          Clear all filters
        </a>
      ) : null}
    </div>
  );
}
