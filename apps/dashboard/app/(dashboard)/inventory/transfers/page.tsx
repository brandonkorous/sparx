import Link from 'next/link';
import { ArrowLeftRight, Plus } from 'lucide-react';

import { Badge, Button, Card, EmptyState } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { TransfersList } from './_components/transfers-list';
import { STATUS_FILTERS, type InventoryTransferRow } from './_components/types';

// Inventory transfers (docs/100 P4) — move stock between warehouses through an
// in-transit holding location. List (filterable by status) + create + detail
// (draft → ship → receive). Standalone-usable.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InventoryTransfersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status) ?? '';

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);

  const [prefs, { data: transfers, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<InventoryTransferRow[]>(`/v1/inventory/transfers?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? transfers.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<ArrowLeftRight className="h-5 w-5" />}
          title="Transfers"
          badge={
            <Badge color="module">
              {total} transfer{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Move stock between warehouses. Shipping leaves the source and holds the units in transit; receiving lands them at the destination — so total inventory stays correct the whole way."
          actions={
            <EntityCreateButton
              entityType="transfer"
              newHref="/inventory/transfers/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New transfer
            </EntityCreateButton>
          }
        />

        <div className="flex flex-row flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = f.value === status;
            const href = f.value
              ? `/inventory/transfers?status=${f.value}`
              : '/inventory/transfers';
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

        <ListToolbar enableViewToggle searchable={false} />

        {transfers.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ArrowLeftRight className="h-5 w-5" />}
              title={status ? `No ${status.replace('_', ' ')} transfers` : 'No transfers yet'}
              description="Move stock between two warehouses. Build the lines, ship to send the units into transit, then receive them at the destination — every leg is recorded in the movement ledger."
              actions={
                <EntityCreateButton
                  entityType="transfer"
                  newHref="/inventory/transfers/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New transfer
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <TransfersList rows={transfers} view={view} />
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
