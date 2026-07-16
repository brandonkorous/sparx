'use client';

import { SelectionList, type SelectionCard, type SelectionColumn, statusLabel } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the bundles list. SelectionList takes render functions
// (columns/card) that can't cross the server→client boundary, so the server
// page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); rows open the bundle editor
// via EntityRowLink in the user's detail-view surface.

export interface BundleRow {
  id: string;
  bundleProductId: string;
  bundleProductTitle: string;
  pricingMode: string;
  fixedPriceCents: number | null;
  percentOffSum: number | null;
  inventoryMode: string;
  componentCount: number;
  updatedAt: string;
}

interface BundlesListProps {
  bundles: BundleRow[];
  view: 'table' | 'card';
}

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function BundlesList({ bundles, view }: BundlesListProps) {
  const titleLink = (b: BundleRow, className?: string) => (
    <EntityRowLink
      href={`/commerce/bundles/${b.id}`}
      entityType="bundle"
      entityId={b.id}
      className={className ?? 'hover:text-module'}
    >
      {b.bundleProductTitle}
    </EntityRowLink>
  );

  const pricingCell = (b: BundleRow) => (
    <>
      <Badge color="info" variant="soft" size="sm">
        {statusLabel(b.pricingMode)}
      </Badge>
      {b.pricingMode === 'fixed' && b.fixedPriceCents != null && (
        <p className="text-base-content mt-1 text-xs">{moneyFmt.format(b.fixedPriceCents / 100)}</p>
      )}
      {b.pricingMode === 'percent_off_sum' && b.percentOffSum != null && (
        <p className="text-base-content mt-1 text-xs">{b.percentOffSum}% off</p>
      )}
    </>
  );

  const inventoryBadge = (b: BundleRow) => (
    <Badge color="neutral" variant="soft" size="sm">
      {statusLabel(b.inventoryMode)}
    </Badge>
  );

  const columns: SelectionColumn<BundleRow>[] = [
    { header: 'Bundle product', cell: (b) => titleLink(b) },
    { header: 'Components', cell: (b) => b.componentCount },
    { header: 'Pricing', cell: pricingCell },
    { header: 'Inventory', cell: inventoryBadge },
    {
      header: 'Updated',
      cell: (b) => (
        <p className="text-base-content text-xs">{new Date(b.updatedAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<BundleRow> = {
    title: (b) => titleLink(b, 'truncate hover:text-module'),
    badge: inventoryBadge,
    body: (b) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between gap-2">{pricingCell(b)}</div>
        <p className="text-base-content text-xs">
          {b.componentCount} component{b.componentCount === 1 ? '' : 's'} · updated{' '}
          {new Date(b.updatedAt).toLocaleDateString()}
        </p>
      </div>
    ),
  };

  return (
    <SelectionList
      items={bundles}
      view={view}
      getId={(b) => b.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
