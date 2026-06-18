import Link from 'next/link';
import { History, X } from 'lucide-react';

import { Badge, Button, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { MovementsFilterBar } from './_components/movements-filter-bar';
import { MovementsList } from './_components/movements-list';
import { type MovementRow } from './_components/types';

// Movement / audit-log viewer (docs/100 P4, docs/99 D5) — a filterable, paginated
// view over the append-only inventory movement ledger: who moved stock, when, why,
// by how much. Read-only. Filter by item (SKU), warehouse, reason, actor, and a
// created-at date range. Standalone-usable.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export default async function InventoryMovementsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const f = {
    variantId: str(params.variant_id),
    sku: str(params.sku),
    warehouseId: str(params.warehouse_id),
    reason: str(params.reason),
    actorType: str(params.actor_type),
    from: str(params.from),
    to: str(params.to),
  };

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (f.variantId) query.set('variant_id', f.variantId);
  if (f.warehouseId) query.set('warehouse_id', f.warehouseId);
  if (f.reason) query.set('reason', f.reason);
  if (f.actorType) query.set('actor_type', f.actorType);
  // Date inputs are date-only; widen to an inclusive UTC day range for the ledger.
  if (f.from) query.set('from', `${f.from}T00:00:00.000Z`);
  if (f.to) query.set('to', `${f.to}T23:59:59.999Z`);

  const [prefs, warehousePage, { data: movements, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<WarehouseOption[]>('/v1/inventory/locations?take=250'),
    api.getPaged<MovementRow[]>(`/v1/inventory/movements?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? movements.length;
  const view = (str(params.view) || prefs.defaultListView) === 'card' ? 'card' : 'table';
  const hasFilters = Boolean(
    f.variantId || f.warehouseId || f.reason || f.actorType || f.from || f.to
  );

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<History className="h-5 w-5" />}
          title="Movements"
          badge={
            <Badge color="module">
              {total} movement{total === 1 ? '' : 's'}
            </Badge>
          }
          description="The audit trail for every stock change — sales, receipts, transfers, recounts, syncs, and manual adjustments. Filter to answer who moved what, when, why, and by how much."
        />

        <MovementsFilterBar
          warehouses={warehousePage.data}
          current={{ ...f, view: view === 'card' ? 'card' : '' }}
        />

        {f.variantId ? (
          <Stack direction="row" gap={2} align="center" wrap>
            <Text size="sm" variant="muted">
              Filtered to item:
            </Text>
            <Badge color="module" variant="soft">
              {f.sku || f.variantId.slice(0, 8)}
            </Badge>
            <Button asChild variant="ghost" size="sm" leftIcon={<X className="h-3.5 w-3.5" />}>
              <Link href={clearVariantHref(f, view)}>Clear item</Link>
            </Button>
          </Stack>
        ) : null}

        <ListToolbar enableViewToggle searchable={false} />

        {movements.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<History className="h-5 w-5" />}
              title={hasFilters ? 'No movements match these filters' : 'No stock movements yet'}
              description={
                hasFilters
                  ? 'Adjust or clear the filters to see more of the ledger.'
                  : 'Every receipt, sale, transfer, recount, and adjustment is recorded here. As soon as stock moves, it shows up.'
              }
            />
          </Card>
        ) : (
          <MovementsList rows={movements} view={view} />
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

/** The current filter set minus the variant — keeps every other active filter. */
function clearVariantHref(
  f: { warehouseId: string; reason: string; actorType: string; from: string; to: string },
  view: 'table' | 'card'
): string {
  const qs = new URLSearchParams();
  if (f.warehouseId) qs.set('warehouse_id', f.warehouseId);
  if (f.reason) qs.set('reason', f.reason);
  if (f.actorType) qs.set('actor_type', f.actorType);
  if (f.from) qs.set('from', f.from);
  if (f.to) qs.set('to', f.to);
  if (view === 'card') qs.set('view', 'card');
  const s = qs.toString();
  return s ? `/inventory/movements?${s}` : '/inventory/movements';
}

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}
