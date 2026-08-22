// The unified browse facet panel (docs/127 §8) — ONE GET <form> that carries every way
// to narrow a product listing, and is DATA-DERIVED end to end: every group and every value
// comes from the tenant's own products via the search index's facet counts, never a list
// hardcoded here. Used by the PLP, collection, and category pages (the whole-catalog and
// scoped browse) so they filter identically.
//
// It composes:
//   · Price + Availability  — the always-present narrowers.
//   · Count facets          — Brand (vendor), Type (product_type), Tags, and one group per
//                             product-OPTION name (Color, Size, … — parsed out of the
//                             `option_facets` counts, so a tenant's own option axes appear
//                             automatically). Each value shows its live count.
//   · Fitment drill         — the generic hierarchical applicability filter (Make→Model→…
//                             for vehicles, Age→Size for apparel, Species→Breed for pets),
//                             preserved from the fitment domain the tenant configured.
//
// All state lives in the URL, so every filtered view is a shareable, SSR-cacheable page and
// the form needs no client JS. Single-value fields (Brand/Type/Tags) are radios; option
// axes are checkboxes under the shared `options` key (repeated params, AND-ed server-side).

import { Button, Input } from '@wizeworks/silicaui-react';

import { ButtonLink } from '@/components/button-link';
import { FitmentFacet, type FitmentLevel } from '@/components/facet-panel';
import type { PublicFitmentDomain, SearchFacets } from '@/lib/commerce';

export interface BrowseFacetValues {
  q?: string;
  sort?: string;
  vendor?: string;
  productType?: string;
  tag?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: boolean;
  /** Selected product-option tokens ("Color:Black", "Size:M"). */
  options: string[];
  /** Active fitment domain slug + per-range-dimension values (for the drill). */
  fitmentDomain?: string;
  fitmentRanges?: Record<string, string>;
}

export interface BrowseFacetsProps {
  action: string;
  /** Typesense facet counts keyed by index field (vendor, product_type, tags, option_facets). */
  facets: SearchFacets;
  values: BrowseFacetValues;
  /** Fitment domain data for the drill (resolved by the page). */
  domains: PublicFitmentDomain[];
  activeDomain: PublicFitmentDomain | null;
  levels: FitmentLevel[];
  /** Catalog price range (cents) → Min/Max placeholders, so even the price hint reflects
   *  the real data rather than a guess. Optional. */
  priceRange?: { minCents: number; maxCents: number };
}

// Single-value count facets: index field → heading + the URL param the page reads. The
// VALUES come from `facets[field]` (real counts), never hardcoded — only the field→label
// mapping lives here.
const COUNT_GROUPS: { field: string; label: string; param: 'vendor' | 'productType' | 'tag' }[] = [
  { field: 'vendor', label: 'Brand', param: 'vendor' },
  { field: 'product_type', label: 'Type', param: 'productType' },
  { field: 'tags', label: 'Tags', param: 'tag' },
];

/** Split the flat `option_facets` counts ("Color:Black", "Size:M") into groups keyed by the
 *  option NAME — so the panel renders exactly the option axes the tenant defined, in the
 *  data, with their real values + counts. The checkbox value stays the full token. */
function optionGroups(
  facets: SearchFacets
): { name: string; values: { token: string; label: string; count: number }[] }[] {
  const counts = facets.option_facets ?? [];
  const byName = new Map<string, { token: string; label: string; count: number }[]>();
  for (const c of counts) {
    const idx = c.value.indexOf(':');
    if (idx <= 0) continue;
    const name = c.value.slice(0, idx);
    const label = c.value.slice(idx + 1);
    const arr = byName.get(name) ?? [];
    arr.push({ token: c.value, label, count: c.count });
    byName.set(name, arr);
  }
  return [...byName.entries()].map(([name, values]) => ({ name, values }));
}

function dollars(cents: number): string {
  return String(Math.round(cents / 100));
}

export function BrowseFacets({
  action,
  facets,
  values,
  domains,
  activeDomain,
  levels,
  priceRange,
}: BrowseFacetsProps) {
  const options = optionGroups(facets);
  const selected = new Set(values.options);

  return (
    <form
      id="browse-filters"
      className="sticky top-[92px] flex scroll-mt-[92px] flex-col gap-6 max-[900px]:static"
      method="GET"
      action={action}
    >
      {/* Preserve the text query + sort across filter submits (sort is owned by the toolbar). */}
      {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
      <input type="hidden" name="sort" value={values.sort ?? 'relevance'} />

      <div>
        <h4 className="text-base-content mt-0 mb-3 text-base font-semibold">Price</h4>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            name="minPrice"
            inputMode="numeric"
            min={0}
            placeholder={priceRange ? dollars(priceRange.minCents) : 'Min'}
            defaultValue={values.minPrice ?? ''}
            className="w-full"
            aria-label="Minimum price (dollars)"
          />
          <span className="text-base-content">–</span>
          <Input
            type="number"
            name="maxPrice"
            inputMode="numeric"
            min={0}
            placeholder={priceRange ? dollars(priceRange.maxCents) : 'Max'}
            defaultValue={values.maxPrice ?? ''}
            className="w-full"
            aria-label="Maximum price (dollars)"
          />
        </div>
      </div>

      <div>
        <h4 className="text-base-content mt-0 mb-3 text-base font-semibold">Availability</h4>
        <label className="text-base-content flex cursor-pointer items-center gap-2 py-1 text-base">
          <input type="checkbox" name="inStock" value="true" defaultChecked={values.inStock} />
          In stock only
        </label>
      </div>

      {/* Brand / Type / Tags — values from the index's facet counts. */}
      {COUNT_GROUPS.map((group) => {
        const counts = facets[group.field];
        if (!counts || counts.length === 0) return null;
        const active = values[group.param];
        return (
          <div key={group.field}>
            <h4 className="text-base-content mt-0 mb-3 text-base font-semibold">{group.label}</h4>
            {counts.slice(0, 10).map((c) => (
              <label
                key={c.value}
                className="text-base-content flex cursor-pointer items-center gap-2 py-1 text-base"
              >
                <input
                  type="radio"
                  name={group.param}
                  value={c.value}
                  defaultChecked={active === c.value}
                />
                <span className="flex-1">{c.value}</span>
                <span className="text-base-content text-sm">{c.count}</span>
              </label>
            ))}
          </div>
        );
      })}

      {/* Product-option axes (Color, Size, …) — derived from the data, one group per option
          NAME the tenant defined. Checkboxes under the shared `options` key so one Color AND
          one Size can both apply. */}
      {options.map((group) => (
        <div key={group.name}>
          <h4 className="text-base-content mt-0 mb-3 text-base font-semibold">{group.name}</h4>
          {group.values.slice(0, 12).map((v) => (
            <label
              key={v.token}
              className="text-base-content flex cursor-pointer items-center gap-2 py-1 text-base"
            >
              <input
                type="checkbox"
                name="options"
                value={v.token}
                defaultChecked={selected.has(v.token)}
              />
              <span className="flex-1">{v.label}</span>
              <span className="text-base-content text-sm">{v.count}</span>
            </label>
          ))}
        </div>
      ))}

      {/* The generic fitment applicability drill (whatever domain the tenant configured). */}
      <FitmentFacet
        domains={domains}
        activeDomain={activeDomain}
        levels={levels}
        values={{ fitmentDomain: values.fitmentDomain, fitmentRanges: values.fitmentRanges }}
      />

      <div className="flex gap-2">
        <Button type="submit" color="primary" className="flex-1">
          Apply
        </Button>
        <ButtonLink
          href={values.q ? `${action}?q=${encodeURIComponent(values.q)}` : action}
          aria-label="Clear filters"
          variant="ghost"
        >
          Clear
        </ButtonLink>
      </div>
    </form>
  );
}
