import Link from 'next/link';
import { Boxes } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Container,
  EmptyState,
  Heading,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

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
    api.get<WarehouseRow[]>('/v1/commerce/warehouses?take=250'),
    api.get<LowStockRow[]>(`/v1/commerce/inventory/low-stock?${lowStockQuery.toString()}`),
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
      `/v1/commerce/inventory/levels/warehouse/${fallbackWarehouse.id}/enriched?${enrichedQuery.toString()}`
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
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Boxes className="h-5 w-5" />}
          title="Inventory"
          badge={fallbackWarehouse && <Badge color="module">{fallbackWarehouse.code}</Badge>}
          description="On-hand is the authoritative count; allocated is the active reservation total across carts, orders, and subscriptions; available = on-hand − allocated."
          actions={
            <Button asChild variant="outline">
              <Link href="/commerce/warehouses">Manage warehouses</Link>
            </Button>
          }
        />

        {warehouses.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="No warehouses yet"
            description="Create a warehouse before tracking inventory."
            action={
              <Button color="module" asChild>
                <Link href="/commerce/warehouses/new">Add warehouse</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ListToolbar
              searchable={false}
              filters={[{ key: 'warehouse', label: 'Warehouses', options: warehouseOptions }]}
              enableViewToggle
            />

            {lowStock.length > 0 && (
              <Card>
                <CardHeader>
                  <Stack gap={1}>
                    <Heading level={3}>Reorder watch</Heading>
                    <CardDescription>
                      Variants at or below their reorder point. Filtered to{' '}
                      {warehouseFilter ? 'the selected warehouse' : 'every warehouse'}.
                    </CardDescription>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Reorder at</TableHead>
                        <TableHead>Suggested order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStock.map((row) => (
                        <TableRow key={`${row.variantId}:${row.warehouseId}`}>
                          <TableCell>
                            <span className="font-mono text-xs">{row.sku}</span>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/commerce/products/${row.productId}`}
                              className="hover:text-[var(--module-active)]"
                            >
                              {row.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.warehouseCode}</Badge>
                          </TableCell>
                          <TableCell>
                            <Text className="text-[var(--color-warning)]">{row.available}</Text>
                          </TableCell>
                          <TableCell>{row.reorderPoint}</TableCell>
                          <TableCell>{row.reorderQuantity ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Stack gap={2}>
              <Heading level={3}>
                Stock at {fallbackWarehouse?.code ?? '—'}
                <Badge variant="outline" className="ml-2 text-xs">
                  {gridRows.length} variants
                </Badge>
              </Heading>
              <Text size="sm" variant="muted">
                Each row shows the latest counts; the inline editor records every change as an
                audited adjustment (sale, recount, manual…).
              </Text>

              {gridRows.length === 0 ? (
                <Card variant="module" padding="none">
                  <EmptyState
                    icon={<Boxes className="h-5 w-5" />}
                    title="No stock tracked at this warehouse"
                    description="As soon as a variant is reserved, sold, or manually adjusted at this warehouse, a row appears here."
                  />
                </Card>
              ) : (
                <InventoryList rows={gridRows} warehouseId={fallbackWarehouse!.id} view={view} />
              )}
            </Stack>
          </>
        )}

        <ListPager total={gridTotal} />
      </Stack>
    </Container>
  );
}
