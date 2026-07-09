import { Truck, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { SuppliersList, type SupplierRow } from './_components/suppliers-list';

// Suppliers — the inbound vendor records (docs/100 P3a). Who stock is purchased
// FROM; purchase orders + receiving (P3b/P3c) build on these. List + create +
// detail (edit/archive + per-variant purchasing links).

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SuppliersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const [prefs, { data: suppliers, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<SupplierRow[]>(
      `/v1/inventory/suppliers?${new URLSearchParams({
        include_archived: 'true',
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? suppliers.length;
  const inactiveOnPage = suppliers.filter((s) => !s.isActive).length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Truck className="h-5 w-5" />}
          title="Suppliers"
          badge={
            <Badge color="module">
              {total} supplier{total === 1 ? '' : 's'}
              {inactiveOnPage ? ` · ${inactiveOnPage} inactive on this page` : ''}
            </Badge>
          }
          description="Vendors you purchase stock from. Each supplier carries contact + default terms; per-variant purchasing detail (their part number, cost, MOQ) is set on the supplier's detail page and feeds purchase orders, receiving, and the moving-average cost basis."
          actions={
            <EntityCreateButton
              entityType="supplier"
              newHref="/inventory/suppliers/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar enableViewToggle searchable={false} />

        {suppliers.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Truck className="h-5 w-5" />}
              title={total === 0 ? 'No suppliers yet' : 'No suppliers on this page'}
              description="Add your first supplier to start tracking who you buy from. Purchase orders and receiving build on suppliers."
              actions={
                <EntityCreateButton
                  entityType="supplier"
                  newHref="/inventory/suppliers/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <SuppliersList rows={suppliers} view={view} />
        )}

        <ListPager total={total} />
      </div>
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
