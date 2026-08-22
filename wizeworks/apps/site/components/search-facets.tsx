// Search-result facet sidebar. Unlike FacetPanel (fitment dropdowns for the
// PLP), this renders Typesense facet COUNTS as checkable filters: vendor,
// product type, fitment make/model/engine, plus price + availability. A single
// GET <form> so every filtered result page is URL-addressable + SSR-cacheable
// and works without client JS — identical interaction model to FacetPanel.
//
// Selecting multiple values within a facet sends repeated params (e.g.
// ?vendor=Northwind&vendor=Acme); the search page reads the first today (the
// api-rest filter is single-value per field) but the markup is multi-ready.

import { Button, Input } from '@wizeworks/silicaui-react';

import { ButtonLink } from './button-link';
import type { SearchFacets } from '@/lib/commerce';

export interface SearchFacetValues {
  q?: string;
  sort?: string;
  vendor?: string;
  productType?: string;
  fitmentMakes?: string;
  fitmentModels?: string;
  fitmentEngines?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: boolean;
}

export interface SearchFacetsProps {
  action: string;
  facets: SearchFacets;
  values: SearchFacetValues;
}

// Facet field → heading + the query param the search page reads. Order here is
// the render order in the sidebar.
const FACET_GROUPS: { field: string; label: string; param: keyof SearchFacetValues }[] = [
  { field: 'vendor', label: 'Brand', param: 'vendor' },
  { field: 'product_type', label: 'Type', param: 'productType' },
  { field: 'fitment_makes', label: 'Fits', param: 'fitmentMakes' },
  { field: 'fitment_models', label: 'Model', param: 'fitmentModels' },
  { field: 'fitment_engines', label: 'Engine', param: 'fitmentEngines' },
];

export function SearchFacets({ action, facets, values }: SearchFacetsProps) {
  const hasAnyFacet = FACET_GROUPS.some((g) => (facets[g.field]?.length ?? 0) > 0);

  return (
    <form
      id="search-filters"
      className="sticky top-[92px] flex flex-col gap-6 max-[900px]:static"
      method="GET"
      action={action}
    >
      {/* Preserve the query + sort across filter submits. */}
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
            placeholder="Min"
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
            placeholder="Max"
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

      {FACET_GROUPS.map((group) => {
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

      {!hasAnyFacet ? (
        <p className="text-base-content text-sm">Refine with price or availability.</p>
      ) : null}
    </form>
  );
}
