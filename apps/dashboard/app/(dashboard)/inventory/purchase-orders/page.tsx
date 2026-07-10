import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';

import { Badge, Button, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { PurchaseOrdersList } from './_components/purchase-orders-list';
import { STATUS_FILTERS, type PurchaseOrderRow } from './_components/types';

// Purchase orders (docs/100 P3b) — the inbound order: buy stock from a supplier,
// receive into a warehouse (receiving is P3c). List (filterable by status) +
// create + detail (header edit / lifecycle / lines / print). Standalone-usable.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status) ?? '';

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);

  const [prefs, { data: orders, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<PurchaseOrderRow[]>(`/v1/inventory/purchase-orders?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? orders.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<ClipboardList className="h-5 w-5" />}
          title="Purchase orders"
          badge={
            <Badge color="module">
              {total} order{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Inbound orders — buy stock from a supplier, received into a warehouse. Draft an order, submit it, then receive against it as goods arrive."
          className="mb-0"
        />
      }
      toolbar={
        <>
          <div className="flex flex-row flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = f.value === status;
              const href = f.value
                ? `/inventory/purchase-orders?status=${f.value}`
                : '/inventory/purchase-orders';
              return (
                <Button
                  key={f.value || 'all'}
                  size="sm"
                  color={active ? 'module' : 'neutral'}
                  variant={active ? 'solid' : 'outline'}
                  render={<Link href={href} aria-current={active ? 'page' : undefined} />}
                >
                  {f.label}
                </Button>
              );
            })}
          </div>

          <ListToolbar
            enableViewToggle
            searchable={false}
            primaryAction={
              <EntityCreateButton
                entityType="purchase-order"
                newHref="/inventory/purchase-orders/new"
                color="module"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            }
          />
        </>
      }
      pager={<ListPager total={total} />}
    >
      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title={status ? `No ${status} purchase orders` : 'No purchase orders yet'}
            description="Draft your first purchase order to restock from a supplier. Add lines, submit, then receive as goods arrive."
            actions={
              <EntityCreateButton
                entityType="purchase-order"
                newHref="/inventory/purchase-orders/new"
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            }
          />
        </Card>
      ) : (
        <PurchaseOrdersList rows={orders} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
