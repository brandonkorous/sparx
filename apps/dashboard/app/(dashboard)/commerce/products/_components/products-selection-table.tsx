'use client';

import * as React from 'react';
import { Archive, DollarSign, Trash2 } from 'lucide-react';
import {
  Badge,
  BulkActionBar,
  type BulkAction,
  Card,
  CardContent,
  Checkbox,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import {
  archiveProductAction,
  bulkUpdateProductStatusAction,
  deleteProductAction,
} from '../../product-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';
import { BulkPriceAdjustModal } from './bulk-price-adjust-modal';

// Client wrapper around the products table/grid that owns selection state and
// surfaces the BulkActionBar. The server page.tsx fetches all data and renders
// the toolbar + header; this component handles the interactive layer only.

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
  const [selected, setSelected] = React.useState<string[]>([]);
  const [priceModalOpen, setPriceModalOpen] = React.useState(false);

  const allIds = products.map((p) => p.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const someSelected = selected.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? [] : allIds);
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'Set active',
      onAction: async (ids) => {
        await bulkUpdateProductStatusAction({ ids, status: 'active' });
      },
    },
    {
      label: 'Set draft',
      onAction: async (ids) => {
        await bulkUpdateProductStatusAction({ ids, status: 'draft' });
      },
    },
    {
      label: 'Adjust prices',
      icon: DollarSign,
      onAction: () => {
        setPriceModalOpen(true);
        return Promise.resolve();
      },
    },
    {
      label: 'Archive',
      icon: Archive,
      onAction: async (ids) => {
        await Promise.all(ids.map((id) => archiveProductAction(id)));
        setSelected([]);
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
        await Promise.all(ids.map((id) => deleteProductAction(id)));
        setSelected([]);
      },
    },
  ];

  const priceModal = (
    <BulkPriceAdjustModal
      open={priceModalOpen}
      onOpenChange={setPriceModalOpen}
      productIds={selected}
      onApplied={() => setSelected([])}
    />
  );

  if (view === 'card') {
    return (
      <>
        <Grid minItemWidth="18rem" gap={4}>
          {products.map((p) => (
            <Card key={p.id} variant="module" padding="md">
              <Stack gap={3}>
                <Stack direction="row" align="start" justify="between" gap={2}>
                  <Stack direction="row" align="start" gap={2} className="min-w-0">
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                      aria-label={`Select ${p.title}`}
                      className="mt-0.5 shrink-0"
                    />
                    <Stack gap={1} className="min-w-0">
                      <EntityRowLink
                        href={`/commerce/products/${p.id}`}
                        entityType="product"
                        entityId={p.id}
                        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {p.title}
                      </EntityRowLink>
                      <Text size="xs" variant="muted">
                        /{p.handle}
                      </Text>
                    </Stack>
                  </Stack>
                  <Badge color={STATUS_VARIANT[p.status] ?? 'outline'} className="text-xs">
                    {p.status}
                  </Badge>
                </Stack>
                <Stack direction="row" align="center" justify="between" gap={2}>
                  <Text size="sm" variant="muted">
                    {p.vendor ?? '—'}
                  </Text>
                  <Text size="sm" className="tabular-nums">
                    {formatPriceRange(p.priceMinCents, p.priceMaxCents)}
                  </Text>
                </Stack>
                <Text size="xs" variant="muted">
                  {variantsLabel(p.variantCount)} · updated{' '}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </Text>
              </Stack>
            </Card>
          ))}
        </Grid>

        <BulkActionBar selected={selected} onClear={() => setSelected([])} actions={bulkActions} />
        {priceModal}
      </>
    );
  }

  return (
    <>
      <Card padding="none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={someSelected ? 'indeterminate' : allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all products"
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Variants</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow
                  key={p.id}
                  data-state={selected.includes(p.id) ? 'selected' : undefined}
                  className="group"
                >
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                      aria-label={`Select ${p.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack gap={1}>
                      <EntityRowLink
                        href={`/commerce/products/${p.id}`}
                        entityType="product"
                        entityId={p.id}
                        className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {p.title}
                      </EntityRowLink>
                      <Text size="xs" variant="muted">
                        /{p.handle}
                      </Text>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Badge color={STATUS_VARIANT[p.status] ?? 'outline'} className="text-xs">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {p.vendor ?? '—'}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {p.productType ?? '—'}
                    </Text>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Text size="sm">{Number.isNaN(p.variantCount) ? '—' : p.variantCount}</Text>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Text size="sm" variant="muted">
                      {formatPriceRange(p.priceMinCents, p.priceMaxCents)}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </Text>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BulkActionBar selected={selected} onClear={() => setSelected([])} actions={bulkActions} />
    </>
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
