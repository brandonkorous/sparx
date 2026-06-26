'use client';

import * as React from 'react';

import { SurfaceSummary, SurfaceSummaryDivider, SurfaceSummaryRow, Text } from '@sparx/ui';

// The product's persistent CONTEXT RAIL content — a non-editable summary of the
// record shown beside the eight edit tabs (docs/86 §5 "the summary is a
// reference"). It is NOT immutable data: it mirrors values that ARE editable
// elsewhere (handle/type/vendor on Overview, price on Pricing, stock on
// Inventory, …) plus derived rollups (variant/option/media counts, inventory
// totals, fitment + catalog reach), surfaced read-only here purely so the whole
// product stays in view while you work one tab. Read-only is the PRESENTATION,
// not the data.
//
// This component renders ONLY the SurfaceSummary tree (the same primitives the
// create wizard's draft summary + the category edit's summary aside use, so it
// reads identically). Its HOST owns the container — `_content.tsx` mounts it as a
// full-height edge-to-edge aside on a wide surface and a stacked tinted card on a
// narrow one, exactly like the wizard's F layout.

export interface ProductSummaryRailProps {
  handle: string;
  productType: string | null;
  vendor: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  currency: string;
  variantCount: number;
  optionCount: number;
  mediaCount: number;
  // null when the tenant tracks no warehouses — the section drops entirely
  // rather than implying a real zero on-hand.
  inventory: { onHand: number; available: number; belowReorder: number } | null;
  fitmentCount: number;
  categoryCount: number;
  collectionCount: number;
  // null for single-site tenants (the scope control hides itself there too).
  siteScope: { scoped: number; total: number } | null;
  averageRating: number | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export function ProductSummaryRail({
  handle,
  productType,
  vendor,
  priceMinCents,
  priceMaxCents,
  currency,
  variantCount,
  optionCount,
  mediaCount,
  inventory,
  fitmentCount,
  categoryCount,
  collectionCount,
  siteScope,
  averageRating,
  reviewCount,
  createdAt,
  updatedAt,
}: ProductSummaryRailProps) {
  return (
    <SurfaceSummary title="Product">
      <SurfaceSummaryRow label="Handle" value={handle} />
      <SurfaceSummaryRow label="Type" value={productType ?? '—'} />
      {vendor && <SurfaceSummaryRow label="Vendor" value={vendor} />}

      <SurfaceSummaryDivider />
      <SurfaceSummaryRow
        label="Price"
        value={formatPriceRange(priceMinCents, priceMaxCents, currency)}
      />
      <SurfaceSummaryRow label="Variants" value={variantCount} />
      {optionCount > 0 && <SurfaceSummaryRow label="Options" value={optionCount} />}
      <SurfaceSummaryRow
        label="Media"
        value={`${mediaCount} ${mediaCount === 1 ? 'image' : 'images'}`}
      />

      {inventory && (
        <>
          <SurfaceSummaryDivider />
          <Text size="sm" variant="muted" className="mb-1">
            Inventory
          </Text>
          <SurfaceSummaryRow label="On hand" value={inventory.onHand.toLocaleString()} />
          <SurfaceSummaryRow label="Available" value={inventory.available.toLocaleString()} />
          <SurfaceSummaryRow
            label="Below reorder"
            value={
              inventory.belowReorder > 0 ? (
                <Text as="span" variant="warning" weight="medium">
                  {inventory.belowReorder}
                </Text>
              ) : (
                0
              )
            }
          />
        </>
      )}

      <SurfaceSummaryDivider />
      {fitmentCount > 0 && (
        <SurfaceSummaryRow
          label="Fitment"
          value={`${fitmentCount} ${fitmentCount === 1 ? 'application' : 'applications'}`}
        />
      )}
      <SurfaceSummaryRow label="Categories" value={categoryCount} />
      <SurfaceSummaryRow label="Collections" value={collectionCount} />
      {siteScope && (
        <SurfaceSummaryRow
          label="Sites"
          value={siteScope.scoped === 0 ? 'All sites' : `${siteScope.scoped} of ${siteScope.total}`}
        />
      )}

      {reviewCount > 0 && (
        <>
          <SurfaceSummaryDivider />
          <SurfaceSummaryRow
            label="Rating"
            value={`${(averageRating ?? 0).toFixed(1)} · ${reviewCount} ${
              reviewCount === 1 ? 'review' : 'reviews'
            }`}
          />
        </>
      )}

      <SurfaceSummaryDivider />
      <SurfaceSummaryRow label="Created" value={formatDate(createdAt)} />
      <SurfaceSummaryRow label="Updated" value={formatDate(updatedAt)} />
    </SurfaceSummary>
  );
}

function formatPriceRange(
  minCents: number | null,
  maxCents: number | null,
  currency: string
): string {
  if (minCents === null && maxCents === null) return 'Not priced';
  const fmt = (cents: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
  const min = minCents ?? maxCents ?? 0;
  const max = maxCents ?? minCents ?? 0;
  return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
