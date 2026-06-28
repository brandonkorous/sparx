// Renders a product's fitment rows, grouped by domain, with column headers
// drawn from each domain's `dimensions` (so a vehicle shows "Make / Model /
// Engine / Year" while a pet store shows "Species / Breed / Weight"). The
// `level` dimensions become the node-path columns; the `range` dimensions
// become numeric columns. Columns with no data across a group are hidden, and
// the panel stays generic over any domain shape.

import { formatFitmentRange } from '@/lib/format';
import type {
  PublicFitmentDimension,
  PublicFitmentDomain,
  PublicProductFitment,
} from '@/lib/commerce';

export interface FitmentTableProps {
  fitments: PublicProductFitment[];
  /** Domain metadata keyed by slug, for level/range labels. */
  domainsBySlug: Record<string, PublicFitmentDomain>;
}

export function FitmentTable({ fitments, domainsBySlug }: FitmentTableProps) {
  // Group rows by domain slug, preserving first-seen order.
  const groups = new Map<string, PublicProductFitment[]>();
  for (const f of fitments) {
    const arr = groups.get(f.domainSlug) ?? [];
    arr.push(f);
    groups.set(f.domainSlug, arr);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {[...groups.entries()].map(([slug, rows]) => (
        <FitmentGroup
          key={slug}
          rows={rows}
          domain={domainsBySlug[slug]}
          showHeading={groups.size > 1}
        />
      ))}
    </div>
  );
}

function FitmentGroup({
  rows,
  domain,
  showHeading,
}: {
  rows: PublicProductFitment[];
  domain: PublicFitmentDomain | undefined;
  showHeading: boolean;
}) {
  // Prefer the domain's declared dimensions; fall back to the dimensions echoed
  // on the fitment row (the PDP read carries them) so labels render even when
  // the domain map wasn't preloaded.
  const dimensions: PublicFitmentDimension[] = domain?.dimensions ?? rows[0]?.dimensions ?? [];
  const levelDims = dimensions.filter((d) => d.kind === 'level');
  const rangeDims = dimensions.filter((d) => d.kind === 'range');

  // A level column is shown only if some row reaches that depth in its path.
  const visibleLevels = levelDims.filter((_, depth) => rows.some((r) => r.nodePath[depth]));
  // A range column is shown only if some row carries a window on that axis.
  const visibleRanges = rangeDims.filter((dim) =>
    rows.some((r) => r.ranges.some((rg) => rg.dimensionKey === dim.key))
  );
  const showNotes = rows.some((r) => r.notes);
  const heading = rows[0]?.domainLabel ?? domain?.displayName ?? 'Fitment';

  return (
    <div>
      {showHeading ? (
        <h3 className="st-h3" style={{ marginBottom: '0.75rem' }}>
          {heading}
        </h3>
      ) : null}
      <div style={{ overflowX: 'auto' }}>
        <table className="st-fitment-table">
          <thead>
            <tr>
              {visibleLevels.length > 0 ? (
                visibleLevels.map((dim) => <th key={dim.key}>{dim.label}</th>)
              ) : (
                <th>Fits</th>
              )}
              {visibleRanges.map((dim) => (
                <th key={dim.key}>{dim.label}</th>
              ))}
              {showNotes ? <th>Notes</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                {visibleLevels.length > 0 ? (
                  visibleLevels.map((dim, depth) => (
                    <td key={dim.key}>{f.nodePath[depth] ?? '—'}</td>
                  ))
                ) : (
                  // A whole-domain (universal) rule with no node path.
                  <td>{f.nodeName ?? 'All'}</td>
                )}
                {visibleRanges.map((dim) => {
                  const rg = f.ranges.find((r) => r.dimensionKey === dim.key);
                  return (
                    <td key={dim.key}>
                      {(rg ? formatFitmentRange(rg.min, rg.max, dim.unit ?? null) : null) ?? '—'}
                    </td>
                  );
                })}
                {showNotes ? <td>{f.notes ?? '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
