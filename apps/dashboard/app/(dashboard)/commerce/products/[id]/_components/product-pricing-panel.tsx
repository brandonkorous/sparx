// Product Pricing tab (docs/09, docs/48). Two cards: (1) the read-only per-variant
// pricing summary — retail price, compare-at, cost, computed margin, and the
// catalog markup rule each variant is priced by (individual prices are edited on
// the Variants tab); (2) the variant-scoped BULK PRICE TIERS editor (quantity
// ramps), created and managed inline here.
//
// Still Phase 3 (noted at the foot): price lists and B2B contract pricing.

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

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
      <Card variant="module">
        <CardHeader>
          <Heading level={3}>Pricing</Heading>
        </CardHeader>
        <CardContent>
          <Text variant="muted">
            No variants yet. Add a variant on the Variants tab to set a price.
          </Text>
        </CardContent>
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
    <Stack gap={6}>
      <Card variant="module">
        <CardHeader>
          <Stack direction="row" align="center" justify="between" gap={3} wrap>
            <Stack gap={1}>
              <Heading level={3}>Pricing</Heading>
              <Text variant="muted" size="sm">
                Current retail price, cost, and margin for each variant. Edit individual prices on
                the Variants tab.
              </Text>
            </Stack>
            <Stack direction="row" align="center" gap={2} wrap>
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
            </Stack>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Compare at</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Priced by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {live.map((v) => {
                  const pct = marginPct(v.priceCents, v.costCents);
                  const rule = v.markupRuleId ? ruleName.get(v.markupRuleId) : null;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Stack direction="row" align="center" gap={2}>
                          <Text className="font-medium">{v.title ?? v.sku}</Text>
                          {v.isDefault && (
                            <Badge color="neutral" variant="soft" size="sm">
                              Default
                            </Badge>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(v.priceCents, v.currency)}
                      </TableCell>
                      <TableCell className="text-right text-[var(--color-text-muted)] tabular-nums">
                        {v.compareAtPriceCents !== null
                          ? money(v.compareAtPriceCents, v.currency)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right text-[var(--color-text-muted)] tabular-nums">
                        {v.costCents !== null ? money(v.costCents, v.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {pct !== null ? (
                          <Badge color={marginColor(pct)} variant="soft" size="sm">
                            {pct.toFixed(1)}%
                          </Badge>
                        ) : (
                          <Text size="sm" variant="muted">
                            —
                          </Text>
                        )}
                      </TableCell>
                      <TableCell>
                        {rule ? (
                          <Badge color="module" variant="soft" size="sm">
                            {rule}
                          </Badge>
                        ) : v.dropshipSourceId ? (
                          <Badge color="neutral" variant="soft" size="sm">
                            {supplierName ?? 'Vendor'}
                          </Badge>
                        ) : (
                          <Text size="sm" variant="muted">
                            Manual
                          </Text>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Text size="xs" variant="muted">
              Price lists and B2B contract pricing are coming in a later release.
            </Text>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="module">
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Bulk price tiers</Heading>
            <Text variant="muted" size="sm">
              Quantity ramps for this product&apos;s variants — e.g. 10+ at a lower unit price. A
              tier applies only when its price beats the otherwise-resolved price; variant tiers
              override price-list tiers.
            </Text>
          </Stack>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </Stack>
  );
}
