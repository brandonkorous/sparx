export const dynamic = 'force-dynamic';

import { Briefcase } from 'lucide-react';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import type { SchedulingService } from '../_lib/types';
import { BOOKING_TYPE_LABEL } from '../_lib/format';
import { NewServiceButton } from './_components/new-service-button';
import { ServicesList } from './_components/services-list';

// Services index — a standard docs/34 List surface: a ListToolbar with search
// + type/status filters + a Table/Cards toggle on top of the shared SelectionList.

const TYPE_OPTIONS = Object.entries(BOOKING_TYPE_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const STATUS_OPTIONS = [{ value: 'active', label: 'Active only' }];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SchedulingServicesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const bookingType = stringParam(params.type);
  const status = stringParam(params.status);

  const [prefs, { data: services, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<SchedulingService[]>(
      `/v1/scheduling/services?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
        ...(bookingType ? { bookingType } : {}),
        ...(status === 'active' ? { activeOnly: 'true' } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? services.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<Briefcase className="h-5 w-5" />}
          title="Services"
          badge={
            <Badge color="module" variant="soft">
              {total} service{total !== 1 ? 's' : ''}
            </Badge>
          }
          description="What customers can book — appointments, classes, reservations, and rentals."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search name or description…"
          filters={[
            { key: 'type', label: 'Types', options: TYPE_OPTIONS },
            { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          ]}
          enableViewToggle
          primaryAction={<NewServiceButton />}
        />
      }
      pager={<ListPager total={total} />}
    >
      {services.length === 0 ? (
        <Card>
          <EmptyState
            title={
              q || bookingType || status ? 'No services match these filters' : 'No services yet'
            }
            description={
              q || bookingType || status
                ? 'Adjust filters or clear the search to broaden the results.'
                : 'Create your first bookable service to start taking bookings.'
            }
            actions={q || bookingType || status ? undefined : <NewServiceButton />}
          />
        </Card>
      ) : (
        <ServicesList services={services} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
