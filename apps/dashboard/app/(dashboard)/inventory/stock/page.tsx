import Link from 'next/link';
import { Boxes } from 'lucide-react';

import { Badge, Button, Card, CardBody, EmptyState, Table } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { InventoryList } from './_components/inventory-list';
import type { InventoryRow } from './_components/inventory-row-editor';

// Inventory — by-warehouse stock view. Lets staff:
//   • Filter to one warehouse
//   • See on-hand / allocated / available per variant
//   • Inline-adjust on-hand with a reason
//   • See which rows are below the reorder point
//
// Lot/serial + transfer flows live on dedicated pages.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  defaultForChannel: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LowStockRow {
  variantId: string;
  productId: string;
  sku: string;
  title: string;
  warehouseId: string;
  warehouseCode: string;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
}

interface EnrichedLevelRow {
  variantId: string;
  warehouseId: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  updatedAt: string;
  sku: string;
  variantTitle: string | null;
  productId: string;
  productTitle: string;
  productHandle: string;
}

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const { skip, take } = parsePageParams(params);
  const warehouseFilter = pickString(params.warehouse);
  const lowStockOnly = pickString(params.low) === '1';

  const lowStockQuery = new URLSearchParams({ take: '50' });
  if (warehouseFilter) lowStockQuery.set('warehouse_id', warehouseFilter);

  const [prefs, warehouses, lowStock] = await Promise.all([
    getUserPreferences(),
    api.get<WarehouseRow[]>('/v1/inventory/locations?take=250'),
    api.get<LowStockRow[]>(`/v1/inventory/low-stock?${lowStockQuery.toString()}`),
  ]);

  const activeWarehouse = warehouseFilter ? warehouses.find((w) => w.id === warehouseFilter) : null;
  const fallbackWarehouse = activeWarehouse ?? warehouses[0] ?? null;

  // Main stock list — paginated. The "Reorder watch" panel above is a separate
  // helper fetch (low-stock) that stays un-paginated.
  let gridItems: EnrichedLevelRow[] = [];
  let gridTotal = 0;
  if (fallbackWarehouse) {
    const enrichedQuery = new URLSearchParams({ take: String(take), skip: String(skip) });
    if (lowStockOnly) enrichedQuery.set('low_stock_only', 'true');
    const { data, meta } = await api.getPaged<EnrichedLevelRow[]>(
      `/v1/inventory/levels/warehouse/${fallbackWarehouse.id}/enriched?${enrichedQuery.toString()}`
    );
    gridItems = data;
    gridTotal = (meta?.total as number | undefined) ?? data.length;
  }
  const warehouseCode = fallbackWarehouse?.code ?? '';
  const gridRows: InventoryRow[] = gridItems.map((r) => ({
    variantId: r.variantId,
    warehouseId: r.warehouseId,
    warehouseCode,
    onHand: r.onHand,
    allocated: r.allocated,
    available: r.available,
    reorderPoint: r.reorderPoint,
    reorderQuantity: r.reorderQuantity,
    leadTimeDays: null,
    sku: r.sku,
    variantTitle: r.variantTitle,
    productId: r.productId,
    productTitle: r.productTitle,
  }));

  const warehouseOptions = warehouses.map((w) => ({
    value: w.id,
    label: `${w.code} — ${w.name}`,
  }));

  const view = (pickString(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Boxes className="h-5 w-5" />}
          title="Inventory"
          badge={fallbackWarehouse && <Badge color="module">{fallbackWarehouse.code}</Badge>}
          description="On-hand is the authoritative count; allocated is the active reservation total across carts, orders, and subscriptions; available = on-hand − allocated."
          // "Manage warehouses" stays a header action (rather than moving into the
          // toolbar) because the toolbar itself doesn't render at all in the
          // no-warehouses state below — this link must stay reachable either way.
          actions={
            <Button variant="outline" size="sm" render={<Link href="/inventory/warehouses" />}>
              Manage warehouses
            </Button>
          }
          className="mb-0"
        />
      }
      toolbar={
        warehouses.length === 0 ? undefined : (
          <ListToolbar
            searchable={false}
            filters={[{ key: 'warehouse', label: 'Warehouses', options: warehouseOptions }]}
            enableViewToggle
          />
        )
      }
      pager={<ListPager total={gridTotal} />}
    >
      {warehouses.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-5 w-5" />}
          title="No warehouses yet"
          description="Create a warehouse before tracking inventory."
          actions={
            <Button color="module" render={<Link href="/inventory/warehouses/new" />}>
              Add warehouse
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {lowStock.length > 0 && (
            <Card>
              <CardBody>
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-semibold">Reorder watch</h3>
                  <p className="opacity-70">
                    Variants at or below their reorder point. Filtered to{' '}
                    {warehouseFilter ? 'the selected warehouse' : 'every warehouse'}.
                  </p>
                </div>
                <Table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Warehouse</th>
                      <th>Available</th>
                      <th>Reorder at</th>
                      <th>Suggested order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((row) => (
                      <tr key={`${row.variantId}:${row.warehouseId}`}>
                        <td>
                          <span className="font-mono text-xs">{row.sku}</span>
                        </td>
                        <td>
                          <Link
                            href={`/commerce/products/${row.productId}`}
                            className="hover:text-module"
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td>
                          <Badge color="neutral" variant="soft" size="sm">
                            {row.warehouseCode}
                          </Badge>
                        </td>
                        <td>
                          <p className="text-warning text-base">{row.available}</p>
                        </td>
                        <td>{row.reorderPoint}</td>
                        <td>{row.reorderQuantity ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardBody>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-semibold">
              Stock at {fallbackWarehouse?.code ?? '—'}
              <Badge color="neutral" variant="soft" size="sm" className="ml-2">
                {gridRows.length} variants
              </Badge>
            </h3>
            <p className="text-base-content/70 text-sm">
              Each row shows the latest counts; the inline editor records every change as an audited
              adjustment (sale, recount, manual…).
            </p>

            {gridRows.length === 0 ? (
              <Card className="bg-module bg-soft">
                <EmptyState
                  icon={<Boxes className="h-5 w-5" />}
                  title="No stock tracked at this warehouse"
                  description="As soon as a variant is reserved, sold, or manually adjusted at this warehouse, a row appears here."
                />
              </Card>
            ) : (
              <InventoryList rows={gridRows} warehouseId={fallbackWarehouse!.id} view={view} />
            )}
          </div>
        </div>
      )}
    </ListPageShell>
  );
}
