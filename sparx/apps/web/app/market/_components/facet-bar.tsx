'use client';

// The browse facet controls (docs/60 §8/§9). Rendered as a responsive top filter
// bar: one chip group per registry facet, each value a toggle carrying a count
// from the API's facet buckets. Faceting algebra (OR within a key, AND across
// keys, counts excluding own selection) lives in the catalog service; this only
// renders the choices and navigates to the chosen view.
//
// ── Why the chips are checkboxes in a form, not links ─────────────────────────
//
// Each chip used to be an `<a href>` to the view with that value toggled. That
// made every browse page a list of links to dozens MORE browse pages, and the
// space they span is every combination of every facet value. rel="nofollow",
// `noindex` and a robots.txt disallow all asked crawlers to stay out of it; on
// 2026-10-18 a distributed scraper ignored all three and walked it at ~30 pages a
// second, which emptied the marketing site's api-rest budget for everyone (see
// MAX_FACET_SELECTIONS in lib/browse-params). Asking is not a fence. A page with
// no links into the space gives a link-following crawler nothing to queue, so the
// choices are now form controls: with JS, a toggle navigates straight to the
// canonical URL; without it, the form submits as a plain GET and the browse page
// canonicalizes it. Filtered views were already `noindex`, so nothing indexable
// is lost.
//
// The cap is enforced here as well as on the server: once a view holds the
// maximum, the remaining chips are disabled and say why, so a person never builds
// a URL the browse page will refuse.

import * as React from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { badgeClasses } from '@wizeworks/silicaui-react/server';

import { getCategory } from '@/lib/marketplace-registry';
import type { MarketplaceFacetBucket } from '@/lib/marketplace';
import {
  MAX_FACET_SELECTIONS,
  canonicalQueryString,
  parseFacetList,
  type BrowseParams,
} from '@/lib/browse-params';

export type { BrowseParams };

/** `/market/:cat?…` for `current` with one facet key replaced (or removed when
 *  the new list is empty). Paging never carries across. CANONICAL, so the same
 *  selection reached in a different order lands on the same URL — see
 *  lib/browse-params for why that matters. */
function hrefWith(categoryId: string, current: BrowseParams, key: string, list: string[]): string {
  const next: BrowseParams = { ...current };
  if (list.length) next[key] = list.join(',');
  else delete next[key];
  delete next.cursor;
  const qs = canonicalQueryString(categoryId, next);
  return `/market/${categoryId}${qs ? `?${qs}` : ''}`;
}

/** The category is passed by id, not as the registry object: that object carries
 *  its icon COMPONENT, which cannot cross from a server component into this one. */
export function FacetBar({
  categoryId,
  facetCounts,
  current,
}: {
  categoryId: string;
  facetCounts: Record<string, MarketplaceFacetBucket>;
  current: BrowseParams;
}) {
  // Held locally so a toggle shows at once, while the navigation it starts loads.
  const [selection, setSelection] = React.useState<BrowseParams>(current);
  const category = getCategory(categoryId);
  if (!category || category.facets.length === 0) return null;

  const total = category.facets.reduce(
    (sum, f) => sum + parseFacetList(selection[f.key]).length,
    0
  );
  const atCap = total >= MAX_FACET_SELECTIONS;

  function toggle(key: string, list: string[]): void {
    const next = { ...selection, [key]: list.join(',') };
    setSelection(next);
    // A full navigation, as the old links were: the browse page re-renders from
    // the server and the Load more island remounts with the new view's cursor.
    window.location.assign(hrefWith(categoryId, current, key, list));
  }

  return (
    <form method="get" action={`/market/${categoryId}`} className="flex flex-col gap-4">
      {/* Without JS the form itself is the request, so it carries the rest of the
          view. With JS these are never submitted. */}
      {current.q ? <input type="hidden" name="q" value={current.q} /> : null}
      {current.sort ? <input type="hidden" name="sort" value={current.sort} /> : null}

      {category.facets.map((facet) => {
        const counts = facetCounts[facet.key] ?? {};
        const selected = parseFacetList(selection[facet.key]);
        // Stable order: by count desc, then name. Hide values with no matches.
        const values = Object.keys(counts)
          .filter((v) => counts[v]! > 0 || selected.includes(v))
          .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));
        if (values.length === 0) return null;

        return (
          <fieldset key={facet.key} className="m-0 flex flex-col gap-2 border-0 p-0">
            {/* A filter GROUP label over its controls — a real form label, not an
                eyebrow. Full ink so it reads. */}
            <legend className="mb-2 p-0 text-sm font-medium">{facet.label}</legend>
            <div className="flex flex-wrap items-center gap-2">
              {values.map((value) => {
                const isOn = selected.includes(value);
                const blocked = atCap && !isOn;
                return (
                  <label
                    key={value}
                    className={`${badgeClasses(
                      isOn
                        ? { color: 'primary', variant: 'solid', size: 'lg' }
                        : { variant: 'outline', size: 'lg' }
                    )} gap-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                      blocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${isOn ? 'font-medium' : ''}`}
                  >
                    <input
                      type="checkbox"
                      name={facet.key}
                      value={value}
                      checked={isOn}
                      disabled={blocked}
                      onChange={() =>
                        toggle(
                          facet.key,
                          isOn ? selected.filter((v) => v !== value) : [...selected, value]
                        )
                      }
                      className="sr-only"
                    />
                    {value}
                    <span className="font-normal">{counts[value] ?? 0}</span>
                    {isOn ? <span aria-hidden>×</span> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {atCap ? (
        <p className="m-0 text-sm" role="status">
          You can use up to {MAX_FACET_SELECTIONS} filters at once. Remove one to pick another.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <noscript>
          <Button type="submit" variant="outline">
            Apply filters
          </Button>
        </noscript>
        {total > 0 ? (
          <a href={`/market/${categoryId}`} className="text-sm underline">
            Clear all filters
          </a>
        ) : null}
      </div>
    </form>
  );
}
