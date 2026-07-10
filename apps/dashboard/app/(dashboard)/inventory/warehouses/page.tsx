import { Warehouse as WarehouseIcon, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { WarehousesList, type WarehouseRow } from './_components/warehouses-list';

// Warehouses — the per-tenant physical/virtual stock locations the
// inventory picker selects between. Phase 2: list + create + archive.
// Per-warehouse inventory editing lives on the inventory page.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WarehousesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const [prefs, { data: warehouses, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<WarehouseRow[]>(
      `/v1/inventory/locations?${new URLSearchParams({
        include_archived: 'true',
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? warehouses.length;

  // The per-row badge in WarehousesList renders each warehouse's active/inactive
  // status; the header badge reports the full warehouse total (across pages).
  const inactiveOnPage = warehouses.filter((w) => !w.isActive).length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<WarehouseIcon className="h-5 w-5" />}
          title="Warehouses"
          badge={
            <Badge color="module">
              {total} warehouse{total === 1 ? '' : 's'}
              {inactiveOnPage ? ` · ${inactiveOnPage} inactive on this page` : ''}
            </Badge>
          }
          description="Inventory levels, lot batches, and serial units all sit beneath a warehouse. A tenant needs at least one active warehouse before stock can be reserved or sold. Dropship suppliers register as a virtual warehouse so the inventory model stays uniform."
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar
          enableViewToggle
          searchPlaceholder="Search name or code…"
          primaryAction={
            <EntityCreateButton
              entityType="warehouse"
              newHref="/inventory/warehouses/new"
              color="module"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />
      }
      pager={<ListPager total={total} />}
    >
      {warehouses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<WarehouseIcon className="h-5 w-5" />}
            title={
              q
                ? 'No warehouses match this search'
                : total === 0
                  ? 'No warehouses yet'
                  : 'No warehouses on this page'
            }
            description={
              q
                ? 'Try a different name or code.'
                : 'Add your first warehouse to start tracking stock. If you sell only digital goods, a single virtual warehouse is all you need.'
            }
            actions={
              q ? undefined : (
                <EntityCreateButton
                  entityType="warehouse"
                  newHref="/inventory/warehouses/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              )
            }
          />
        </Card>
      ) : (
        <WarehousesList rows={warehouses} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
