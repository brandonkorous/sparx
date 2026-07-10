export const dynamic = 'force-dynamic';

import { Repeat } from 'lucide-react';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import type { BookingSeriesSummary } from '../_lib/types';
import { SeriesList } from './_components/series-list';

// Recurring-series index — a standard docs/34 List surface: a ListToolbar with
// search + a status filter + a Table/Cards toggle on top of the shared
// SelectionList. No "New" primary action — series are only created from the
// Bookings tab's "Repeat" toggle, not directly here.

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SchedulingSeriesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const status = stringParam(params.status);

  const [prefs, { data: series, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<BookingSeriesSummary[]>(
      `/v1/scheduling/series?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? series.length;
  const active = series.filter((s) => s.status === 'active').length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<Repeat className="h-5 w-5" />}
          title="Recurring"
          badge={
            <Badge color="module" variant="soft">
              {active} active
            </Badge>
          }
          description="Recurring booking series — each one materializes into individual bookings you can manage one by one. Create a series from the Bookings tab by turning on “Repeat”."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search service name or pattern…"
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
          enableViewToggle
        />
      }
      pager={<ListPager total={total} />}
    >
      {series.length === 0 ? (
        <Card>
          <EmptyState
            title={
              q || status ? 'No recurring series match these filters' : 'No recurring series yet'
            }
            description={
              q || status
                ? 'Adjust filters or clear the search to broaden the results.'
                : 'Book something on the Bookings tab and toggle “Repeat this booking” to set up a weekly, daily, or monthly series.'
            }
          />
        </Card>
      ) : (
        <SeriesList series={series} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
