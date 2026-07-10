export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { ListPager } from '../../_components/list-pager';
import type { Booking, SchedulingService } from '../_lib/types';
import { NewBookingButton } from './_components/new-booking-button';
import { BookingsList } from './_components/bookings-list';
import { BookingsFilters, type BookingsFilterResource } from './_components/bookings-filters';

const FILTERS: { label: string; status?: string }[] = [
  { label: 'All' },
  { label: 'Requested', status: 'requested' },
  { label: 'Confirmed', status: 'confirmed' },
  { label: 'In progress', status: 'in_progress' },
  { label: 'Completed', status: 'completed' },
  { label: 'Cancelled', status: 'cancelled' },
];

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SchedulingBookingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = typeof params.status === 'string' ? params.status : undefined;
  const resource = typeof params.resource === 'string' ? params.resource : undefined;
  const service = typeof params.service === 'string' ? params.service : undefined;
  const q = typeof params.q === 'string' ? params.q : undefined;

  const qs = new URLSearchParams({ take: String(take), skip: String(skip), order: 'desc' });
  if (status) qs.set('status', status);
  if (resource) qs.set('resourceId', resource);
  if (service) qs.set('serviceId', service);
  if (q) qs.set('q', q);

  const [{ data: bookings, meta }, services, resources] = await Promise.all([
    api
      .getPaged<Booking[]>(`/v1/scheduling/bookings?${qs}`)
      .catch(() => ({ data: [] as Booking[], meta: {}, etag: null })),
    api.get<SchedulingService[]>('/v1/scheduling/services').catch(() => [] as SchedulingService[]),
    api
      .get<BookingsFilterResource[]>('/v1/scheduling/resources')
      .catch(() => [] as BookingsFilterResource[]),
  ]);

  // Preserve the resource/service/search filters when switching status chips.
  const chipHref = (nextStatus?: string): string => {
    const p = new URLSearchParams();
    if (nextStatus) p.set('status', nextStatus);
    if (resource) p.set('resource', resource);
    if (service) p.set('service', service);
    if (q) p.set('q', q);
    const s = p.toString();
    return s ? `/scheduling/bookings?${s}` : '/scheduling/bookings';
  };
  const total = ((meta as Record<string, unknown>)?.total as number | undefined) ?? bookings.length;

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<CalendarClock className="h-5 w-5" />}
          title="Bookings"
          badge={
            <Badge color="module" variant="soft">
              {total} booking{total !== 1 ? 's' : ''}
            </Badge>
          }
          description="Every appointment, class, reservation, and rental — confirm, check in, reschedule, or cancel."
          actions={<NewBookingButton />}
          className="mb-0"
        />
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = (f.status ?? '') === (status ?? '');
              return (
                <Link key={f.label} href={chipHref(f.status)}>
                  <Badge color={active ? 'module' : 'neutral'} variant={active ? 'solid' : 'soft'}>
                    {f.label}
                  </Badge>
                </Link>
              );
            })}
          </div>
          <BookingsFilters
            status={status ?? ''}
            resource={resource ?? ''}
            service={service ?? ''}
            q={q ?? ''}
            resources={resources}
            services={services.map((s) => ({ id: s.id, name: s.name }))}
          />
        </div>
      }
      pager={<ListPager total={total} />}
    >
      {bookings.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              title={
                q
                  ? 'No bookings match this search'
                  : status
                    ? `No ${status.replace('_', ' ')} bookings`
                    : 'No bookings yet'
              }
              description={
                q
                  ? 'Try a different note or guest name.'
                  : services.length === 0
                    ? 'Create a service and set availability, then take your first booking.'
                    : 'New bookings will appear here. Create one to get started.'
              }
              actions={q || services.length === 0 ? undefined : <NewBookingButton />}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <BookingsList bookings={bookings} />
          </CardBody>
        </Card>
      )}
    </ListPageShell>
  );
}
