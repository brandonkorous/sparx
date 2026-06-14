import { Warehouse as WarehouseIcon, Plus } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
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
  const [prefs, warehouses] = await Promise.all([
    getUserPreferences(),
    api.get<WarehouseRow[]>('/v1/commerce/warehouses?include_archived=true'),
  ]);

  const active = warehouses.filter((w) => w.isActive);
  const inactive = warehouses.filter((w) => !w.isActive);

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<WarehouseIcon className="h-5 w-5" />}
          title="Warehouses"
          badge={
            <Badge color="module">
              {active.length} active{inactive.length ? ` · ${inactive.length} inactive` : ''}
            </Badge>
          }
          description="Inventory levels, lot batches, and serial units all sit beneath a warehouse. A tenant needs at least one active warehouse before stock can be reserved or sold. Dropship suppliers register as a virtual warehouse so the inventory model stays uniform."
          actions={
            <EntityCreateButton
              entityType="warehouse"
              newHref="/commerce/warehouses/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar enableViewToggle searchable={false} />

        {warehouses.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<WarehouseIcon className="h-5 w-5" />}
              title="No warehouses yet"
              description="Add your first warehouse to start tracking stock. If you sell only digital goods, a single virtual warehouse is all you need."
              action={
                <EntityCreateButton
                  entityType="warehouse"
                  newHref="/commerce/warehouses/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <WarehousesList rows={warehouses} view={view} />
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
