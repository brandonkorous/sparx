// Faceted filter panel for the PLP. Rendered as a single GET <form> so the
// URL fully captures the filter state — every result page is SSR-cacheable and
// works without client JS. Sort is preserved via a hidden field (the toolbar's
// SortSelect owns changing it).
//
// Fitment is fully generic over the active domain's `dimensions`: the panel
// drills the `level` dimensions one tier at a time (each pick reloads the form,
// revealing the next level's children) and narrows by the `range` dimensions
// (a numeric widget per range axis). There are NO hardcoded make/model/engine
// labels — every label comes from the domain's dimension list, so the same
// panel serves a vehicle shop (Make → Model → Engine, Year) and a pet store
// (Species → Breed, Weight). With multiple domains a switcher appears; choosing
// one + Apply reloads the form with that domain's tree. Vendor/tag facets need
// an aggregation endpoint to enumerate values and land later.

import { Button, Input, NativeSelect } from '@wizeworks/silicaui-react';

import { ButtonLink } from './button-link';

import type {
  PublicFitmentDimension,
  PublicFitmentDomain,
  PublicFitmentNode,
} from '@/lib/commerce';

/** One resolved drill level: the dimension it represents, the nodes the
 *  customer can pick from at this tier, and the currently-selected node id (if
 *  any). The page resolves this chain server-side from the URL selections. */
export interface FitmentLevel {
  dimension: PublicFitmentDimension;
  nodes: PublicFitmentNode[];
  selectedId: string;
}

export interface FacetValues {
  q?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: boolean;
  fitmentDomain?: string; // domain slug
  /** Numeric value per range dimension key (year / weight / size). */
  fitmentRanges?: Record<string, string>;
}

export interface FacetPanelProps {
  action: string;
  domains: PublicFitmentDomain[];
  /** The currently-active domain (chosen via ?fitmentDomain= or the only/first
   *  one). Null when the tenant installed no fitment domains. */
  activeDomain: PublicFitmentDomain | null;
  /** The resolved level chain: one entry per `level` dimension that is reachable
   *  given the current selections (level N appears once level N-1 is picked). */
  levels: FitmentLevel[];
  values: FacetValues;
}

const YEAR_NOW = 2026;
const YEARS = Array.from({ length: 50 }, (_, i) => YEAR_NOW - i);
const US_SHOES = Array.from({ length: 21 }, (_, i) => (5 + i * 0.5).toString());
const EU_SHOES = Array.from({ length: 16 }, (_, i) => (35 + i).toString());

const COLUMN_LABEL = {
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '0.4rem',
} as const;

export function FacetPanel({ action, domains, activeDomain, levels, values }: FacetPanelProps) {
  return (
    <form id="plp-filters" className="st-facets" method="GET" action={action}>
      {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
      <input type="hidden" name="sort" value={values.sort ?? 'relevance'} />

      <div className="st-facet">
        <h4>Price</h4>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Input
            type="number"
            name="minPrice"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            defaultValue={values.minPrice ?? ''}
            style={{ width: '100%' }}
            aria-label="Minimum price (dollars)"
          />
          <span className="st-muted">–</span>
          <Input
            type="number"
            name="maxPrice"
            inputMode="numeric"
            min={0}
            placeholder="Max"
            defaultValue={values.maxPrice ?? ''}
            style={{ width: '100%' }}
            aria-label="Maximum price (dollars)"
          />
        </div>
      </div>

      <div className="st-facet">
        <h4>Availability</h4>
        <label>
          <input type="checkbox" name="inStock" value="true" defaultChecked={values.inStock} />
          In stock only
        </label>
      </div>

      <FitmentFacet domains={domains} activeDomain={activeDomain} levels={levels} values={values} />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button type="submit" color="primary" style={{ flex: 1 }}>
          Apply
        </Button>
        <ButtonLink href={action} aria-label="Clear filters" color="neutral" variant="ghost">
          Clear
        </ButtonLink>
      </div>
    </form>
  );
}

// The fitment narrowing block: an optional domain switcher, one <select> per
// reachable `level` tier (a generic node drill — picking one reveals the next),
// and a numeric widget per `range` dimension. Fully generic over the active
// domain's `dimensions`; renders nothing when no domain is installed.
function FitmentFacet({
  domains,
  activeDomain,
  levels,
  values,
}: Pick<FacetPanelProps, 'domains' | 'activeDomain' | 'levels' | 'values'>) {
  if (!activeDomain) return null;
  const rangeDimensions = activeDomain.dimensions.filter((d) => d.kind === 'range');
  const fitmentRanges = values.fitmentRanges ?? {};

  return (
    <div className="st-facet">
      <h4>
        {domains.length > 1 ? 'Fits your' : `Fits your ${activeDomain.displayName.toLowerCase()}`}
      </h4>

      {domains.length > 1 ? (
        <label style={{ ...COLUMN_LABEL, marginBottom: '0.5rem' }}>
          <span className="st-muted" style={{ fontSize: '0.78rem' }}>
            Type
          </span>
          <NativeSelect name="fitmentDomain" defaultValue={activeDomain.slug}>
            {domains.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.displayName}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}

      {/* `level` dimensions: one <select> per reachable tier. Each select is
          named fl<index> and carries node ids; picking one + Apply reveals the
          next tier (the page resolves children server-side). */}
      {levels.map((level, i) => (
        <label
          key={level.dimension.key}
          style={{ ...COLUMN_LABEL, marginTop: i === 0 ? undefined : '0.5rem' }}
        >
          <span className="st-muted" style={{ fontSize: '0.78rem' }}>
            {level.dimension.label}
          </span>
          <NativeSelect name={`fl${i}`} defaultValue={level.selectedId}>
            <option value="">Any {level.dimension.label.toLowerCase()}</option>
            {level.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      ))}

      {/* `range` dimensions: a numeric narrowing widget per axis, named by its
          dimension key. The unit drives the widget (year picker, shoe size, or
          a plain number input with a unit suffix). */}
      {rangeDimensions.map((dim) => (
        <label key={dim.key} style={{ ...COLUMN_LABEL, marginTop: '0.5rem' }}>
          <span className="st-muted" style={{ fontSize: '0.78rem' }}>
            {dim.label}
          </span>
          <RangeWidget dim={dim} value={fitmentRanges[dim.key]} />
        </label>
      ))}
    </div>
  );
}

// Range widget chosen by the dimension's unit. Writes to the dimension's key so
// the page reads one param per range axis, regardless of vertical.
function RangeWidget({ dim, value }: { dim: PublicFitmentDimension; value?: string }) {
  const unit = dim.unit ?? null;
  const unitSuffix = (() => {
    switch (unit) {
      case 'lb':
        return 'lb';
      case 'kg':
        return 'kg';
      case 'mm':
        return 'mm';
      case 'in':
        return 'in';
      case 'month':
        return 'months';
      default:
        return '';
    }
  })();

  if (unit === 'year') {
    return (
      <NativeSelect name={dim.key} defaultValue={value ?? ''}>
        <option value="">Any {dim.label.toLowerCase()}</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </NativeSelect>
    );
  }

  if (unit === 'us_shoe' || unit === 'eu_shoe') {
    const sizes = unit === 'us_shoe' ? US_SHOES : EU_SHOES;
    return (
      <NativeSelect name={dim.key} defaultValue={value ?? ''}>
        <option value="">Any {dim.label.toLowerCase()}</option>
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </NativeSelect>
    );
  }

  // Numeric units (weight, age, dimension) → number input with a unit suffix.
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <Input
        type="number"
        name={dim.key}
        inputMode="decimal"
        min={0}
        step="any"
        placeholder={dim.label}
        defaultValue={value ?? ''}
        style={{ width: '100%' }}
        aria-label={`${dim.label}${unitSuffix ? ` (${unitSuffix})` : ''}`}
      />
      {unitSuffix ? <span className="st-muted">{unitSuffix}</span> : null}
    </span>
  );
}
