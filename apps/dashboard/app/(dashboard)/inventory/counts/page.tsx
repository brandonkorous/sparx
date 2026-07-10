import Link from 'next/link';
import { ClipboardCheck, Plus } from 'lucide-react';

import { Badge, Button, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { CountsList } from './_components/counts-list';
import { STATUS_FILTERS, type InventoryCountRow } from './_components/types';

// Inventory counts (docs/100 P4) — reconcile recorded stock against a physical
// count. A cycle count covers a chosen subset; a full count every level in the
// warehouse. List (filterable by status) + create + detail (count → review →
// approve → post recount movements). Standalone-usable.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InventoryCountsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status) ?? '';
  const q = stringParam(params.q);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);
  if (q) query.set('q', q);

  const [prefs, { data: counts, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<InventoryCountRow[]>(`/v1/inventory/counts?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? counts.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="Counts"
          badge={
            <Badge color="module">
              {total} count{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Reconcile recorded stock against a physical count. Capture counted quantities, review the variance, and post — large variances need an approval before they apply."
          className="mb-0"
        />
      }
      toolbar={
        <>
          <div className="flex flex-row flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = f.value === status;
              const href = f.value ? `/inventory/counts?status=${f.value}` : '/inventory/counts';
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
            searchPlaceholder="Search count number or warehouse…"
            primaryAction={
              <EntityCreateButton
                entityType="count"
                newHref="/inventory/counts/new"
                color="module"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New count
              </EntityCreateButton>
            }
          />
        </>
      }
      pager={<ListPager total={total} />}
    >
      {counts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title={
              q ? 'No counts match this search' : status ? `No ${status} counts` : 'No counts yet'
            }
            description={
              q
                ? 'Try a different count number or warehouse name.'
                : 'Start a cycle count of a few SKUs or a full physical count of a warehouse. Enter the counted quantities, then post to correct stock with an audit trail.'
            }
            actions={
              q ? undefined : (
                <EntityCreateButton
                  entityType="count"
                  newHref="/inventory/counts/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New count
                </EntityCreateButton>
              )
            }
          />
        </Card>
      ) : (
        <CountsList rows={counts} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
