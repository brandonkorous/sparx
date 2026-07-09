// Product Pricing tab (docs/09, docs/48). Two cards: (1) the read-only per-variant
// pricing summary — retail price, compare-at, cost, computed margin, and the
// catalog markup rule each variant is priced by (individual prices are edited on
// the Variants tab); (2) the variant-scoped BULK PRICE TIERS editor (quantity
// ramps), created and managed inline here.
//
// Still Phase 3 (noted at the foot): price lists and B2B contract pricing.

import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';

import { ProductBulkTiersEditor, type BulkTierRow } from './product-bulk-tiers-editor';

export interface PricingVariant {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  currency: string;
  markupRuleId: string | null;
  // Set when the variant was imported from a dropship supplier — its price was
  // seeded from the vendor's MSRP, so "Priced by" reads "Vendor", not "Manual".
  dropshipSourceId: string | null;
  isDefault: boolean;
  deletedAt: string | null;
}

interface ProductPricingPanelProps {
  variants: PricingVariant[];
  markupRules: { id: string; name: string }[];
  // The dropship supplier this product was imported from, when known — used as
  // the "Priced by" label for vendor-sourced variants. Falls back to "Vendor".
  supplierName?: string | null;
  // This product's variant-scoped bulk price tiers (quantity ramps).
  tiers: BulkTierRow[];
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(
    cents / 100
  );
}

// Gross margin on the retail price: (price − cost) / price. Null when there's no
// cost on file or the price is zero (can't divide), so the cell shows "—".
function marginPct(priceCents: number, costCents: number | null): number | null {
  if (costCents === null || priceCents <= 0) return null;
  return ((priceCents - costCents) / priceCents) * 100;
}

function marginColor(pct: number): 'success' | 'warning' | 'neutral' {
  if (pct >= 20) return 'success';
  if (pct >= 10) return 'warning';
  return 'neutral';
}

export function ProductPricingPanel({
  variants,
  markupRules,
  supplierName,
  tiers,
}: ProductPricingPanelProps) {
  const live = variants.filter((v) => v.deletedAt === null);
  const ruleName = new Map(markupRules.map((r) => [r.id, r.name]));

  if (live.length === 0) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-xl font-semibold">Pricing</h3>
          <p className="text-base-content/70">
            No variants yet. Add a variant on the Variants tab to set a price.
          </p>
        </CardBody>
      </Card>
    );
  }

  const prices = live.map((v) => v.priceCents);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const currency = live[0]?.currency ?? 'USD';

  const margins = live
    .map((v) => marginPct(v.priceCents, v.costCents))
    .filter((m): m is number => m !== null);
  const avgMargin =
    margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Pricing</h3>
              <p className="text-base-content/70 text-sm">
                Current retail price, cost, and margin for each variant. Edit individual prices on
                the Variants tab.
              </p>
            </div>
            <div className="flex flex-row flex-wrap items-center gap-2">
              <Badge color="neutral" variant="soft" size="sm">
                {minPrice === maxPrice
                  ? money(minPrice, currency)
                  : `${money(minPrice, currency)} – ${money(maxPrice, currency)}`}
              </Badge>
              {avgMargin !== null && (
                <Badge color={marginColor(avgMargin)} variant="soft" size="sm">
                  {avgMargin.toFixed(1)}% avg margin
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Table>
              <thead>
                <tr>
                  <th>Variant</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Compare at</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Margin</th>
                  <th>Priced by</th>
                </tr>
              </thead>
              <tbody>
                {live.map((v) => {
                  const pct = marginPct(v.priceCents, v.costCents);
                  const rule = v.markupRuleId ? ruleName.get(v.markupRuleId) : null;
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="flex flex-row items-center gap-2">
                          <span className="font-medium">{v.title ?? v.sku}</span>
                          {v.isDefault && (
                            <Badge color="neutral" variant="soft" size="sm">
                              Default
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{money(v.priceCents, v.currency)}</td>
                      <td className="text-base-content/60 text-right tabular-nums">
                        {v.compareAtPriceCents !== null
                          ? money(v.compareAtPriceCents, v.currency)
                          : '—'}
                      </td>
                      <td className="text-base-content/60 text-right tabular-nums">
                        {v.costCents !== null ? money(v.costCents, v.currency) : '—'}
                      </td>
                      <td className="text-right">
                        {pct !== null ? (
                          <Badge color={marginColor(pct)} variant="soft" size="sm">
                            {pct.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-base-content/70 text-sm">—</span>
                        )}
                      </td>
                      <td>
                        {rule ? (
                          <Badge color="module" variant="soft" size="sm">
                            {rule}
                          </Badge>
                        ) : v.dropshipSourceId ? (
                          <Badge color="neutral" variant="soft" size="sm">
                            {supplierName ?? 'Vendor'}
                          </Badge>
                        ) : (
                          <span className="text-base-content/70 text-sm">Manual</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            <p className="text-base-content/70 text-xs">
              Price lists and B2B contract pricing are coming in a later release.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Bulk price tiers</h3>
            <p className="text-base-content/70 text-sm">
              Quantity ramps for this product&apos;s variants — e.g. 10+ at a lower unit price. A
              tier applies only when its price beats the otherwise-resolved price; variant tiers
              override price-list tiers.
            </p>
          </div>
          <ProductBulkTiersEditor
            variants={live.map((v) => ({
              id: v.id,
              sku: v.sku,
              title: v.title,
              priceCents: v.priceCents,
              currency: v.currency,
            }))}
            tiers={tiers}
          />
        </CardBody>
      </Card>
    </div>
  );
}
