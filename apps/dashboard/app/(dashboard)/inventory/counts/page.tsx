import Link from 'next/link';
import { ClipboardCheck, Plus } from 'lucide-react';

import { Badge, Button, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

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

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);

  const [prefs, { data: counts, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<InventoryCountRow[]>(`/v1/inventory/counts?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? counts.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="Counts"
          badge={
            <Badge color="module">
              {total} count{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Reconcile recorded stock against a physical count. Capture counted quantities, review the variance, and post — large variances need an approval before they apply."
          actions={
            <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
              <Link href="/inventory/counts/new">New count</Link>
            </Button>
          }
        />

        <Stack direction="row" gap={2} wrap>
          {STATUS_FILTERS.map((f) => {
            const active = f.value === status;
            const href = f.value ? `/inventory/counts?status=${f.value}` : '/inventory/counts';
            return (
              <Button
                key={f.value || 'all'}
                asChild
                size="sm"
                color={active ? 'module' : 'neutral'}
                variant={active ? 'solid' : 'outline'}
              >
                <Link href={href} aria-current={active ? 'page' : undefined}>
                  {f.label}
                </Link>
              </Button>
            );
          })}
        </Stack>

        <ListToolbar enableViewToggle searchable={false} />

        {counts.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" />}
              title={status ? `No ${status} counts` : 'No counts yet'}
              description="Start a cycle count of a few SKUs or a full physical count of a warehouse. Enter the counted quantities, then post to correct stock with an audit trail."
              action={
                <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
                  <Link href="/inventory/counts/new">New count</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <CountsList rows={counts} view={view} />
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
