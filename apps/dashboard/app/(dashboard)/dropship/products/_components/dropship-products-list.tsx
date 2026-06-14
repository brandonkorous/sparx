'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, RefreshCw } from 'lucide-react';
import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Button,
  Stack,
  Text,
  toast,
} from '@sparx/ui';

import { resyncSupplierProduct } from '../../suppliers/_lib/catalog-actions';

// Client wrapper for the dropship products list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands serializable groups (one per supplier) + view here and this
// builds both views. Read-only (`selectable={false}`, no bulk bar). Rows are not
// individually navigable as entities — the "View in catalog →" island links each
// imported product to its commerce record (preserved from the original table).
// Grouping by supplier is preserved: each group renders its header (name, count,
// Browse-catalog link) followed by one SelectionList; the view toggle flips them
// all together.

export interface DropshipProduct {
  id: string;
  supplierProductId: string;
  title: string;
  images: string[];
  costPriceCents: number;
  msrpCents: number | null;
  isImported: boolean;
  // The COMMERCE publish state of the imported product (draft/active/archived) —
  // what governs whether it shows on the site. Null when not yet imported.
  productStatus: string | null;
  links: { id: string; productId: string; status: string }[];
}

export interface SupplierGroup {
  supplier: { id: string; name: string; type: string };
  products: DropshipProduct[];
}

interface DropshipProductsListProps {
  groups: SupplierGroup[];
  view: 'table' | 'card';
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function calcMarginPct(costCents: number, msrpCents: number | null): string | null {
  if (!msrpCents || msrpCents <= costCents) return null;
  return (((msrpCents - costCents) / msrpCents) * 100).toFixed(1);
}

// The commerce publish state shown on each row. Labels are deliberately phrased
// around site visibility ("Live" / "Draft") so an imported product never reads
// as on-sale when it's actually a hidden draft.
const PRODUCT_STATUS: Record<string, { color: 'success' | 'warning' | 'neutral'; label: string }> =
  {
    active: { color: 'success', label: 'Live' },
    draft: { color: 'neutral', label: 'Draft' },
    archived: { color: 'warning', label: 'Archived' },
  };

function productCell(p: DropshipProduct) {
  return (
    <Stack direction="row" gap={3} className="items-center">
      {p.images[0] ? (
        <img
          src={p.images[0]}
          alt={p.title}
          className="h-9 w-9 flex-shrink-0 rounded bg-[var(--color-muted)] object-cover"
        />
      ) : (
        <div className="h-9 w-9 flex-shrink-0 rounded bg-[var(--color-muted)]" />
      )}
      <Stack gap={0}>
        <Text className="line-clamp-1 font-medium">{p.title}</Text>
        {p.links[0] && (
          <Link
            href={`/commerce/products/${p.links[0].productId}`}
            className="text-xs text-[var(--color-muted-foreground)] hover:underline"
          >
            View in catalog →
          </Link>
        )}
      </Stack>
    </Stack>
  );
}

function supplierIdCell(p: DropshipProduct) {
  return (
    <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
      {p.supplierProductId}
    </span>
  );
}

function costCell(p: DropshipProduct) {
  return p.costPriceCents > 0 ? formatCents(p.costPriceCents) : '—';
}

function msrpCell(p: DropshipProduct) {
  return (
    <span className="text-[var(--color-muted-foreground)]">
      {p.msrpCents ? formatCents(p.msrpCents) : '—'}
    </span>
  );
}

function marginCell(p: DropshipProduct) {
  const margin = calcMarginPct(p.costPriceCents, p.msrpCents);
  if (margin === null) {
    return (
      <Text size="sm" className="text-[var(--color-muted-foreground)]">
        —
      </Text>
    );
  }
  return (
    <Badge
      color={Number(margin) >= 20 ? 'success' : Number(margin) >= 10 ? 'warning' : 'neutral'}
      variant="soft"
      size="sm"
    >
      {margin}%
    </Badge>
  );
}

function statusCell(p: DropshipProduct) {
  const meta = p.productStatus
    ? (PRODUCT_STATUS[p.productStatus] ?? {
        color: 'neutral' as const,
        label: p.productStatus,
      })
    : { color: 'neutral' as const, label: 'Not imported' };
  return (
    <Badge color={meta.color} variant="soft" size="sm">
      {meta.label}
    </Badge>
  );
}

// Per-row "Re-sync": re-pulls this imported product from the supplier — refreshes
// availability (always orderable) and BACKFILLS the supplier's images onto the
// commerce product when it has none. This is the discoverable home for the action
// that was previously buried on the supplier catalog page; the supplier-level
// "Refresh catalog" only re-fetches the browsable list, it doesn't touch an
// already-imported product.
function ResyncButton({ supplierId, productId }: { supplierId: string; productId: string }) {
  const [resyncing, startResync] = useTransition();
  const router = useRouter();
  return (
    <Button
      color="neutral"
      variant="ghost"
      size="sm"
      disabled={resyncing}
      onClick={() =>
        startResync(async () => {
          const { imagesAdded, error } = await resyncSupplierProduct(supplierId, productId);
          if (error) {
            toast.error('Re-sync failed', { description: error });
            return;
          }
          toast.success('Re-synced from supplier', {
            description:
              imagesAdded && imagesAdded > 0
                ? `Updated availability and added ${imagesAdded} image${imagesAdded === 1 ? '' : 's'}.`
                : 'Updated availability from the supplier.',
          });
          router.refresh();
        })
      }
    >
      <RefreshCw className={`mr-1 h-4 w-4 ${resyncing ? 'animate-spin' : ''}`} />
      {resyncing ? 'Re-syncing…' : 'Re-sync'}
    </Button>
  );
}

// Columns/card are built per supplier group so the Re-sync action can close over
// the group's supplier id (SelectionList cell renderers only receive the row).
function makeColumns(supplierId: string): SelectionColumn<DropshipProduct>[] {
  return [
    { header: 'Product', cell: productCell },
    { header: 'Supplier ID', cell: supplierIdCell },
    { header: 'Cost', cell: costCell },
    { header: 'MSRP', cell: msrpCell },
    { header: 'Margin', cell: marginCell },
    { header: 'Status', cell: statusCell },
    {
      header: 'Sync',
      align: 'right',
      cell: (p) => <ResyncButton supplierId={supplierId} productId={p.id} />,
    },
  ];
}

function makeCard(supplierId: string): SelectionCard<DropshipProduct> {
  return {
    title: (p) => <Text className="truncate font-medium">{p.title}</Text>,
    subtitle: (p) =>
      p.links[0] ? (
        <Link
          href={`/commerce/products/${p.links[0].productId}`}
          className="text-xs text-[var(--color-muted-foreground)] hover:underline"
        >
          View in catalog →
        </Link>
      ) : (
        <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
          {p.supplierProductId}
        </span>
      ),
    badge: statusCell,
    body: (p) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {costCell(p)} cost
          </Text>
          {marginCell(p)}
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" className="text-[var(--color-muted-foreground)]">
            MSRP {p.msrpCents ? formatCents(p.msrpCents) : '—'}
          </Text>
          <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
            {p.supplierProductId}
          </span>
        </Stack>
        <Stack direction="row" justify="end">
          <ResyncButton supplierId={supplierId} productId={p.id} />
        </Stack>
      </>
    ),
  };
}

export function DropshipProductsList({ groups, view }: DropshipProductsListProps) {
  return (
    <Stack gap={8}>
      {groups.map(({ supplier, products }) => (
        <Stack key={supplier.id} gap={3}>
          <Stack direction="row" gap={2} className="items-center">
            <Text className="font-semibold">{supplier.name}</Text>
            <Badge color="neutral" variant="soft" size="sm">
              {products.length} products
            </Badge>
            <Link
              href={`/dropship/suppliers/${supplier.id}/catalog`}
              className="ml-auto flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              Browse catalog <ExternalLink className="h-3 w-3" />
            </Link>
          </Stack>
          <SelectionList
            items={products}
            view={view}
            getId={(p) => p.id}
            selectable={false}
            columns={makeColumns(supplier.id)}
            card={makeCard(supplier.id)}
          />
        </Stack>
      ))}
    </Stack>
  );
}
