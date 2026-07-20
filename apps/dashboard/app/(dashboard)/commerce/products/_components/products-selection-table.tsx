'use client';

import * as React from 'react';
import { Archive, DollarSign, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { Badge } from '@wizeworks/silicaui-react';
import {
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  statusLabel,
  statusTone,
  toast,
  useConfirm,
} from '@sparx/ui';

import {
  archiveProductAction,
  bulkSetProductMarketStateAction,
  bulkUpdateProductStatusAction,
  deleteProductAction,
  getProductPlacementsAction,
} from '../../product-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';
import { BulkMarketListModal } from './bulk-market-list-modal';
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

export function ProductsSelectionTable({ products, view }: ProductsSelectionTableProps) {
  const confirm = useConfirm();
  const [priceModalOpen, setPriceModalOpen] = React.useState(false);
  const [priceTargetIds, setPriceTargetIds] = React.useState<string[]>([]);
  const [marketModalOpen, setMarketModalOpen] = React.useState(false);
  const [marketTargetIds, setMarketTargetIds] = React.useState<string[]>([]);

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
      label: 'List on sparx.market',
      icon: ShoppingBag,
      onAction: (ids) => {
        // Listing needs a category for the selection, so it opens a picker
        // modal rather than firing immediately.
        setMarketTargetIds(ids);
        setMarketModalOpen(true);
        return Promise.resolve();
      },
    },
    {
      label: 'Remove from sparx.market',
      icon: Store,
      requiresConfirm: true,
      confirmLabel:
        'Remove {count} product(s) from sparx.market? They’ll disappear from the marketplace immediately. The products themselves are untouched.',
      onAction: async (ids) => {
        const res = await bulkSetProductMarketStateAction({ productIds: ids, listed: false });
        if (!res.ok) {
          toast.error('Could not remove products from sparx.market', {
            description: res.error.message,
          });
          return;
        }
        const n = res.data.updated;
        toast.success(
          n === 1 ? 'Product removed from sparx.market' : `${n} products removed from sparx.market`
        );
      },
    },
    {
      label: 'Archive',
      icon: Archive,
      requiresConfirm: true,
      confirmLabel:
        'Archive {count} product(s)? They’ll be hidden from your site and lists — restore them any time from the archived filter.',
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
      // No declarative `requiresConfirm` here, unlike the other destructive actions:
      // the warning depends on what we find. Pages built to show one of these products
      // will render a hole once it's gone, and the owner needs to know WHICH pages
      // before deciding — a static string can't say that. One dialog either way, so
      // this is a richer confirm, not a second one.
      onAction: async (ids) => {
        const placements = await getProductPlacementsAction(ids);
        const shown = placements.flatMap((p) => p.pages);
        const pageList = [...new Set(shown)];
        const base = `Variants, options, and media will be permanently removed. This can’t be undone.`;
        const ok = await confirm({
          title: `Delete ${ids.length} product${ids.length === 1 ? '' : 's'}?`,
          description:
            pageList.length > 0
              ? `${placements.length === 1 ? 'One of these products is' : `${placements.length} of these products are`} shown on ${pageList.length === 1 ? 'a page' : 'pages'} you’ve built: ${pageList.join(', ')}. ${pageList.length === 1 ? 'That page' : 'Those pages'} will have a gap where ${placements.length === 1 ? 'it' : 'they'} used to be. ${base}`
              : base,
          confirmLabel: `Delete product${ids.length === 1 ? '' : 's'}`,
          tone: 'danger',
        });
        if (!ok) return;
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
    <Badge color={statusTone(p.status)} variant="soft" size="sm">
      {statusLabel(p.status)}
    </Badge>
  );

  const columns: SelectionColumn<ProductListItem>[] = [
    {
      header: 'Title',
      cell: (p) => (
        <div className="flex flex-col gap-1">
          {titleLink(p, 'text-sm font-medium hover:text-module hover:underline')}
          <p className="text-base-content text-xs">/{p.handle}</p>
        </div>
      ),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Vendor',
      cell: (p) => <p className="text-base-content text-sm">{p.vendor ?? '—'}</p>,
    },
    {
      header: 'Type',
      cell: (p) => <p className="text-base-content text-sm">{p.productType ?? '—'}</p>,
    },
    {
      header: 'Variants',
      align: 'right',
      cell: (p) => <p className="text-sm">{Number.isNaN(p.variantCount) ? '—' : p.variantCount}</p>,
    },
    {
      header: 'Price',
      align: 'right',
      cell: (p) => (
        <p className="text-base-content text-sm">
          {formatPriceRange(p.priceMinCents, p.priceMaxCents)}
        </p>
      ),
    },
    {
      header: 'Updated',
      cell: (p) => (
        <p className="text-base-content text-sm">{new Date(p.updatedAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<ProductListItem> = {
    title: (p) => titleLink(p, 'truncate text-sm font-medium hover:text-module hover:underline'),
    subtitle: (p) => <p className="text-base-content text-xs">/{p.handle}</p>,
    badge: statusBadge,
    body: (p) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-sm">{p.vendor ?? '—'}</p>
          <p className="text-sm tabular-nums">
            {formatPriceRange(p.priceMinCents, p.priceMaxCents)}
          </p>
        </div>
        <p className="text-base-content text-xs">
          {variantsLabel(p.variantCount)} · updated {new Date(p.updatedAt).toLocaleDateString()}
        </p>
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
        <>
          <BulkPriceAdjustModal
            open={priceModalOpen}
            onOpenChange={setPriceModalOpen}
            productIds={priceModalOpen ? priceTargetIds : selected}
            onApplied={() => setPriceModalOpen(false)}
          />
          <BulkMarketListModal
            open={marketModalOpen}
            onOpenChange={setMarketModalOpen}
            productIds={marketModalOpen ? marketTargetIds : selected}
            onListed={() => setMarketModalOpen(false)}
          />
        </>
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
