'use client';

import * as React from 'react';
import { Archive, DollarSign, Trash2 } from 'lucide-react';
import {
  Badge,
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  Stack,
  Text,
  toast,
} from '@sparx/ui';

import {
  archiveProductAction,
  bulkUpdateProductStatusAction,
  deleteProductAction,
} from '../../product-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';
import { BulkPriceAdjustModal } from './bulk-price-adjust-modal';

// Products table/grid — selection + bulk actions on top of the shared
// `SelectionList` dual-view substrate (docs/34 §7). The server page renders the
// toolbar + header and passes `view`; this owns the interactive layer only.

export interface ProductListItem {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string | null;
  productType: string | null;
  variantCount: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  updatedAt: string;
}

interface ProductsSelectionTableProps {
  products: ProductListItem[];
  view: 'table' | 'card';
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline'> = {
  active: 'success',
  draft: 'outline',
  archived: 'warning',
};

export function ProductsSelectionTable({ products, view }: ProductsSelectionTableProps) {
  const [priceModalOpen, setPriceModalOpen] = React.useState(false);
  const [priceTargetIds, setPriceTargetIds] = React.useState<string[]>([]);

  const bulkActions: BulkAction[] = [
    {
      label: 'Set active',
      onAction: async (ids) => {
        const res = await bulkUpdateProductStatusAction({ productIds: ids, status: 'active' });
        if (!res.ok) {
          toast.error('Could not publish products', { description: res.error.message });
          return;
        }
        const n = res.data.updated;
        toast.success(n === 1 ? 'Product published' : `${n} products published`, {
          description: 'They’re now live on your site.',
        });
      },
    },
    {
      label: 'Set draft',
      onAction: async (ids) => {
        const res = await bulkUpdateProductStatusAction({ productIds: ids, status: 'draft' });
        if (!res.ok) {
          toast.error('Could not move products to draft', { description: res.error.message });
          return;
        }
        const n = res.data.updated;
        toast.success(n === 1 ? 'Product set to draft' : `${n} products set to draft`, {
          description: 'They’re hidden from your site until published again.',
        });
      },
    },
    {
      label: 'Adjust prices',
      icon: DollarSign,
      onAction: (ids) => {
        setPriceTargetIds(ids);
        setPriceModalOpen(true);
        return Promise.resolve();
      },
    },
    {
      label: 'Archive',
      icon: Archive,
      onAction: async (ids) => {
        const results = await Promise.all(ids.map((id) => archiveProductAction(id)));
        const failed = results.filter((r) => !r.ok).length;
        if (failed > 0) {
          toast.error(
            `Couldn’t archive ${failed} of ${ids.length} product${ids.length === 1 ? '' : 's'}`
          );
          return;
        }
        toast.success(ids.length === 1 ? 'Product archived' : `${ids.length} products archived`, {
          description: 'Archived products are hidden from your site and lists.',
        });
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} product{count === 1 ? "" : "s"}? Variants, options, and media will be permanently removed. This cannot be undone.',
      onAction: async (ids) => {
        const results = await Promise.all(ids.map((id) => deleteProductAction(id)));
        const failed = results.filter((r) => !r.ok).length;
        if (failed > 0) {
          toast.error(
            `Couldn’t delete ${failed} of ${ids.length} product${ids.length === 1 ? '' : 's'}`
          );
          return;
        }
        toast.success(ids.length === 1 ? 'Product deleted' : `${ids.length} products deleted`);
      },
    },
  ];

  const titleLink = (p: ProductListItem, className: string) => (
    <EntityRowLink
      href={`/commerce/products/${p.id}`}
      entityType="product"
      entityId={p.id}
      className={className}
    >
      {p.title}
    </EntityRowLink>
  );

  const statusBadge = (p: ProductListItem) => (
    <Badge color={STATUS_VARIANT[p.status] ?? 'outline'} className="text-xs">
      {p.status}
    </Badge>
  );

  const columns: SelectionColumn<ProductListItem>[] = [
    {
      header: 'Title',
      cell: (p) => (
        <Stack gap={1}>
          {titleLink(p, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline')}
          <Text size="xs" variant="muted">
            /{p.handle}
          </Text>
        </Stack>
      ),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Vendor',
      cell: (p) => (
        <Text size="sm" variant="muted">
          {p.vendor ?? '—'}
        </Text>
      ),
    },
    {
      header: 'Type',
      cell: (p) => (
        <Text size="sm" variant="muted">
          {p.productType ?? '—'}
        </Text>
      ),
    },
    {
      header: 'Variants',
      align: 'right',
      cell: (p) => <Text size="sm">{Number.isNaN(p.variantCount) ? '—' : p.variantCount}</Text>,
    },
    {
      header: 'Price',
      align: 'right',
      cell: (p) => (
        <Text size="sm" variant="muted">
          {formatPriceRange(p.priceMinCents, p.priceMaxCents)}
        </Text>
      ),
    },
    {
      header: 'Updated',
      cell: (p) => (
        <Text size="sm" variant="muted">
          {new Date(p.updatedAt).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<ProductListItem> = {
    title: (p) =>
      titleLink(
        p,
        'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'
      ),
    subtitle: (p) => (
      <Text size="xs" variant="muted">
        /{p.handle}
      </Text>
    ),
    badge: statusBadge,
    body: (p) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {p.vendor ?? '—'}
          </Text>
          <Text size="sm" className="tabular-nums">
            {formatPriceRange(p.priceMinCents, p.priceMaxCents)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          {variantsLabel(p.variantCount)} · updated {new Date(p.updatedAt).toLocaleDateString()}
        </Text>
      </>
    ),
  };

  return (
    <SelectionList
      items={products}
      view={view}
      getId={(p) => p.id}
      getRowLabel={(p) => p.title}
      entityLabelPlural="products"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
      renderAfter={({ selected }) => (
        <BulkPriceAdjustModal
          open={priceModalOpen}
          onOpenChange={setPriceModalOpen}
          productIds={priceModalOpen ? priceTargetIds : selected}
          onApplied={() => setPriceModalOpen(false)}
        />
      )}
    />
  );
}

function variantsLabel(n: number): string {
  if (Number.isNaN(n)) return '—';
  return `${n} variant${n === 1 ? '' : 's'}`;
}

function formatPriceRange(minCents: number | null, maxCents: number | null): string {
  if (minCents == null) return '—';
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  if (maxCents == null || minCents === maxCents) return fmt(minCents);
  return `${fmt(minCents)}–${fmt(maxCents)}`;
}
