export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { CalendarEvent, SchedulingService } from '../_lib/types';
import { NewBookingButton } from '../bookings/_components/new-booking-button';
import { WeekCalendar } from './_components/week-calendar';

const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseFrom(from: string | undefined): Date {
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const [y, m, d] = from.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
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
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  const weekStart = weekStartOf(parseFrom(sp.from));
  // Fetch a day of padding either side so a booking that lands in an adjacent
  // local-day column (timezone offset) is still in the payload the grid buckets.
  const rangeFrom = new Date(weekStart.getTime() - DAY_MS).toISOString();
  const rangeTo = new Date(weekStart.getTime() + 8 * DAY_MS).toISOString();

  const [events, services] = await Promise.all([
    api
      .get<
        CalendarEvent[]
      >(`/v1/scheduling/bookings/calendar?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`)
      .catch(() => [] as CalendarEvent[]),
    api.get<SchedulingService[]>('/v1/scheduling/services').catch(() => [] as SchedulingService[]),
  ]);

  return (
    // The shell's content area is a non-flex `overflow-y-auto flex-1` region, so a
    // percentage `h-full` collapses to content height. Pin to the viewport minus
    // the shell's 48px (h-12) top header so the grid genuinely fills top-to-bottom.
    <div className="flex h-[calc(100dvh-3rem)] flex-col gap-4 p-4">
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title="Calendar"
        description="Your week at a glance — every booking on one grid."
        actions={services.length > 0 ? <NewBookingButton services={services} /> : undefined}
      />

      {services.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title="Set up scheduling"
            description="Create a service and set your hours — then your bookings appear here on the week grid."
            action={
              <Link href="/scheduling/services">
                <Button color="module">Create your first service</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <WeekCalendar weekStartYmd={ymd(weekStart)} events={events} />
      )}
    </div>
  );
}
