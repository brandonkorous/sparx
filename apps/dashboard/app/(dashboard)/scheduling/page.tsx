export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { LayoutDashboard, ArrowRight } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Container,
  EmptyState,
  Grid,
  PageHeader,
  Stack,
  Stat,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { CalendarEvent, SchedulingService } from './_lib/types';
import { BOOKING_TYPE_LABEL, formatTime, STATUS_LABEL, statusColor } from './_lib/format';
import type { BookingStatus } from './_lib/types';
import { NewBookingButton } from './bookings/_components/new-booking-button';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date().toDateString();
  const tomorrow = new Date(Date.now() + DAY_MS).toDateString();
  if (d.toDateString() === today) return 'Today';
  if (d.toDateString() === tomorrow) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export default async function SchedulingOverviewPage() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const to = new Date(Date.now() + 14 * DAY_MS).toISOString();

  const [events, services] = await Promise.all([
    api
      .get<
        CalendarEvent[]
      >(`/v1/scheduling/bookings/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .catch(() => [] as CalendarEvent[]),
    api.get<SchedulingService[]>('/v1/scheduling/services').catch(() => [] as SchedulingService[]),
  ]);

  const todayStr = now.toDateString();
  const weekEnd = Date.now() + 7 * DAY_MS;
  const todayCount = events.filter((e) => dayKey(e.startAt) === todayStr).length;
  const weekCount = events.filter((e) => new Date(e.startAt).getTime() <= weekEnd).length;
  const pending = events.filter((e) => e.status === 'requested').length;

  // Group the next 7 days of events by calendar day.
  const upcoming = events
    .filter((e) => new Date(e.startAt).getTime() <= weekEnd)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of upcoming) {
    const k = dayKey(e.startAt);
    const arr = groups.get(k);
    if (arr) arr.push(e);
    else groups.set(k, [e]);
  }

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<LayoutDashboard className="h-5 w-5" />}
          title="Overview"
          description="Your upcoming bookings at a glance — the next two weeks. Open the Calendar for the week grid."
          actions={services.length > 0 ? <NewBookingButton /> : undefined}
        />

        {services.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title="Set up scheduling"
              description="Create a service, add the staff or resources that deliver it, then set their hours — and you're taking bookings."
              action={
                <Link href="/scheduling/services">
                  <Button color="module">
                    Create your first service
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <Grid cols={1} mdCols={3} gap={4}>
              <Card>
                <CardContent className="py-5">
                  <Stat label="Today" value={String(todayCount)} hint="bookings" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5">
                  <Stat label="Next 7 days" value={String(weekCount)} hint="bookings" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5">
                  <Stat label="Awaiting confirmation" value={String(pending)} hint="requests" />
                </CardContent>
              </Card>
            </Grid>

            {upcoming.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  title="Nothing scheduled"
                  description="No bookings in the next 7 days. New bookings will show up here."
                />
              </Card>
            ) : (
              <Stack gap={5}>
                {[...groups.entries()].map(([key, dayEvents]) => (
                  <div key={key}>
                    <Text className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                      {dayHeading(dayEvents[0]!.startAt)}
                    </Text>
                    <Card padding="none">
                      <Stack gap={0}>
                        {dayEvents.map((e) => (
                          <Link
                            key={e.id}
                            href="/scheduling/bookings"
                            className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0 hover:bg-[var(--color-muted)]"
                          >
                            <div className="flex items-center gap-4">
                              <span className="w-20 shrink-0 text-sm font-medium tabular-nums">
                                {formatTime(e.startAt)}
                              </span>
                              <span className="flex flex-col">
                                <span className="text-sm font-medium">{e.serviceName}</span>
                                <span className="text-xs text-[var(--color-muted-foreground)]">
                                  {BOOKING_TYPE_LABEL[
                                    e.bookingType as keyof typeof BOOKING_TYPE_LABEL
                                  ] ?? e.bookingType}
                                  {e.resourceNames.length ? ` · ${e.resourceNames.join(', ')}` : ''}
                                  {e.partySize ? ` · party of ${e.partySize}` : ''}
                                </span>
                              </span>
                            </div>
                            <Badge color={statusColor(e.status as BookingStatus)} variant="soft">
                              {STATUS_LABEL[e.status as BookingStatus] ?? e.status}
                            </Badge>
                          </Link>
                        ))}
                      </Stack>
                    </Card>
                  </div>
                ))}
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
