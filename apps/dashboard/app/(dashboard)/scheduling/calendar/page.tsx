export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { Button, Card, CardBody, EmptyState } from 'silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { CalendarEvent, SchedulingService } from '../_lib/types';
import { NewBookingButton } from '../bookings/_components/new-booking-button';
import { WeekCalendar } from './_components/week-calendar';
import { CalendarFilters, type CalendarResource } from './_components/calendar-filters';

const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseFrom(from: string | undefined): Date {
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const [y = 0, m = 1, d = 1] = from.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

/** Snap any date to the Sunday that opens its week. */
function weekStartOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export default async function SchedulingCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; resource?: string; service?: string }>;
}) {
  const sp = await searchParams;
  const weekStart = weekStartOf(parseFrom(sp.from));
  // Fetch a day of padding either side so a booking that lands in an adjacent
  // local-day column (timezone offset) is still in the payload the grid buckets.
  const rangeFrom = new Date(weekStart.getTime() - DAY_MS).toISOString();
  const rangeTo = new Date(weekStart.getTime() + 8 * DAY_MS).toISOString();

  // Filter to one resource / service when the toolbar narrows the view.
  const calParams = new URLSearchParams({ from: rangeFrom, to: rangeTo });
  if (sp.resource) calParams.set('resourceId', sp.resource);
  if (sp.service) calParams.set('serviceId', sp.service);

  const [events, services, resources] = await Promise.all([
    api
      .get<CalendarEvent[]>(`/v1/scheduling/bookings/calendar?${calParams.toString()}`)
      .catch(() => [] as CalendarEvent[]),
    api.get<SchedulingService[]>('/v1/scheduling/services').catch(() => [] as SchedulingService[]),
    api.get<CalendarResource[]>('/v1/scheduling/resources').catch(() => [] as CalendarResource[]),
  ]);

  const weekYmd = ymd(weekStart);

  return (
    // The shell's content area is a non-flex `overflow-y-auto flex-1` region, so a
    // percentage `h-full` collapses to content height. Pin to the viewport minus
    // the shell's 48px (h-12) top header so the grid genuinely fills top-to-bottom.
    <div className="flex h-[calc(100dvh-3rem)] flex-col gap-4 p-4">
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title="Calendar"
        description="Your week at a glance — every booking on one grid."
        actions={
          services.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <CalendarFilters
                from={weekYmd}
                resource={sp.resource ?? ''}
                service={sp.service ?? ''}
                resources={resources}
                services={services.map((s) => ({ id: s.id, name: s.name }))}
              />
              <NewBookingButton />
            </div>
          ) : undefined
        }
      />

      {services.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              title="Set up scheduling"
              description="Create a service and set your hours — then your bookings appear here on the week grid."
              actions={
                <Link href="/scheduling/services">
                  <Button color="module">Create your first service</Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <WeekCalendar
          weekStartYmd={weekYmd}
          events={events}
          resource={sp.resource ?? ''}
          service={sp.service ?? ''}
        />
      )}
    </div>
  );
}
