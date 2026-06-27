'use client';

import {
  Badge,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
} from '@sparx/ui';

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
      className={className ?? 'hover:text-[var(--module-active)]'}
    >
      {b.bundleProductTitle}
    </EntityRowLink>
  );

  const pricingCell = (b: BundleRow) => (
    <>
      <Badge variant="outline">{b.pricingMode}</Badge>
      {b.pricingMode === 'fixed' && b.fixedPriceCents != null && (
        <Text size="xs" variant="muted" className="mt-1">
          {moneyFmt.format(b.fixedPriceCents / 100)}
        </Text>
      )}
      {b.pricingMode === 'percent_off_sum' && b.percentOffSum != null && (
        <Text size="xs" variant="muted" className="mt-1">
          {b.percentOffSum}% off
        </Text>
      )}
    </>
  );

  const inventoryBadge = (b: BundleRow) => <Badge variant="outline">{b.inventoryMode}</Badge>;

  const columns: SelectionColumn<BundleRow>[] = [
    { header: 'Bundle product', cell: (b) => titleLink(b) },
    { header: 'Components', cell: (b) => b.componentCount },
    { header: 'Pricing', cell: pricingCell },
    { header: 'Inventory', cell: inventoryBadge },
    {
      header: 'Updated',
      cell: (b) => (
        <Text size="xs" variant="muted">
          {new Date(b.updatedAt).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<BundleRow> = {
    title: (b) => titleLink(b, 'truncate hover:text-[var(--module-active)]'),
    badge: inventoryBadge,
    body: (b) => (
      <Stack gap={2}>
        <Stack direction="row" align="center" justify="between" gap={2}>
          {pricingCell(b)}
        </Stack>
        <Text size="xs" variant="muted">
          {b.componentCount} component{b.componentCount === 1 ? '' : 's'} · updated{' '}
          {new Date(b.updatedAt).toLocaleDateString()}
        </Text>
      </Stack>
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
