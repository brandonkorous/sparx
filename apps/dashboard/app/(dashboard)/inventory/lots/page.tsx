import Link from 'next/link';
import { CircleAlert, Plus, X } from 'lucide-react';

import { Badge, Button, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { LotsFilterBar } from './_components/lots-filter-bar';
import { LotsList } from './_components/lots-list';
import { type LotRow } from './_components/types';

// Lots & serials (docs/100 P4d) — batch traceability for regulated / expiring /
// serialized stock. List (filter by item, lot number, warehouse, recall state,
// expiring soon) + create + detail (serial roster + status changes + recall).
// Standalone-usable. Quantities here are traceability metadata; authoritative
// on-hand lives on the (variant, warehouse) level.

export const dynamic = 'force-dynamic';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export default async function LotsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const f = {
    variantId: str(params.variant_id),
    sku: str(params.sku),
    warehouseId: str(params.warehouse_id),
    recallStatus: str(params.recall_status),
    expiring: str(params.expiring) === '1',
    q: str(params.q),
  };

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (f.variantId) query.set('variant_id', f.variantId);
  if (f.warehouseId) query.set('warehouse_id', f.warehouseId);
  if (f.recallStatus) query.set('recall_status', f.recallStatus);
  if (f.q) query.set('q', f.q);
  // The "expiring soon" toggle widens to a one-year horizon from now.
  if (f.expiring) query.set('expiring_before', new Date(Date.now() + ONE_YEAR_MS).toISOString());

  const [prefs, warehousePage, { data: lots, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<WarehouseOption[]>('/v1/inventory/locations?take=250'),
    api.getPaged<LotRow[]>(`/v1/inventory/lots?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? lots.length;
  const view = (str(params.view) || prefs.defaultListView) === 'card' ? 'card' : 'table';
  const hasFilters = Boolean(f.variantId || f.warehouseId || f.recallStatus || f.expiring || f.q);

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<CircleAlert className="h-5 w-5" />}
          title="Lots & serials"
          badge={
            <Badge color="module">
              {total} lot{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Batch + serial traceability for regulated, expiring, or serialized stock. Hazmat-flagged batches inform shipping routing; a recall flips the affected serials and surfaces who to notify."
          actions={
            <EntityCreateButton
              entityType="lot"
              newHref="/inventory/lots/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New lot
            </EntityCreateButton>
          }
        />

        <LotsFilterBar
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

        {lots.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<CircleAlert className="h-5 w-5" />}
              title={hasFilters ? 'No lots match these filters' : 'No lots yet'}
              description={
                hasFilters
                  ? 'Adjust or clear the filters to see more.'
                  : 'Create a lot to track a batch by expiry, hazmat class, supplier reference, and per-unit serials — and to drive recalls.'
              }
              action={
                <EntityCreateButton
                  entityType="lot"
                  newHref="/inventory/lots/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New lot
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <LotsList rows={lots} view={view} />
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

/** The current filter set minus the variant — keeps every other active filter. */
function clearVariantHref(
  f: { warehouseId: string; recallStatus: string; expiring: boolean; q: string },
  view: 'table' | 'card'
): string {
  const qs = new URLSearchParams();
  if (f.warehouseId) qs.set('warehouse_id', f.warehouseId);
  if (f.recallStatus) qs.set('recall_status', f.recallStatus);
  if (f.expiring) qs.set('expiring', '1');
  if (f.q) qs.set('q', f.q);
  if (view === 'card') qs.set('view', 'card');
  const s = qs.toString();
  return s ? `/inventory/lots?${s}` : '/inventory/lots';
}

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}
