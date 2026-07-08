export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Clock,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, CardBody, EmptyState } from 'silicaui-react';
import { ActionQueue, ActionTile, BarList, PageHeader, Stat } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { CardLink, OverviewCard, fmtMoneyCents, fmtNumber } from '../_components/overview-bits';
import { EntityRowLink } from '../_components/entity-row-link';
import type {
  BookingStatus,
  CalendarEvent,
  SchedulingReport,
  SchedulingService,
  WaitlistEntry,
} from './_lib/types';
import { BOOKING_TYPE_LABEL, formatTime, STATUS_LABEL, statusColor } from './_lib/format';
import { NewBookingButton } from './bookings/_components/new-booking-button';

// Scheduling overview — the front-desk morning glance: what's on today and this
// week, what's waiting on you (confirmations + waitlist), and how the calendar
// is performing. The upcoming agenda is the page's primary (tinted) card; the
// outcome mix and busiest services ride alongside as neutral analytics. Every
// section is live from /v1/scheduling/* and empty-states when there's nothing.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGENDA = 8;

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayHeading(iso: string): string {
  const d = new Date(iso).toDateString();
  if (d === new Date().toDateString()) return 'Today';
  if (d === new Date(Date.now() + DAY_MS).toDateString()) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

function eventMeta(e: CalendarEvent): string {
  const parts = [
    BOOKING_TYPE_LABEL[e.bookingType as keyof typeof BOOKING_TYPE_LABEL] ?? e.bookingType,
  ];
  if (e.resourceNames.length) parts.push(e.resourceNames.join(', '));
  if (e.partySize) parts.push(`party of ${e.partySize}`);
  return parts.join(' · ');
}

export default async function SchedulingOverviewPage() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const to = new Date(Date.now() + 14 * DAY_MS).toISOString();
  const reportFrom = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const reportTo = now.toISOString();

  const [events, services, report, waitlist] = await Promise.all([
    api
      .get<
        CalendarEvent[]
      >(`/v1/scheduling/bookings/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .catch(() => [] as CalendarEvent[]),
    api.get<SchedulingService[]>('/v1/scheduling/services').catch(() => [] as SchedulingService[]),
    api
      .get<SchedulingReport>(
        `/v1/scheduling/reports?from=${encodeURIComponent(reportFrom)}&to=${encodeURIComponent(reportTo)}`
      )
      .catch(() => null),
    api.get<WaitlistEntry[]>('/v1/scheduling/waitlist').catch(() => [] as WaitlistEntry[]),
  ]);

  const todayStr = now.toDateString();
  const weekEnd = Date.now() + 7 * DAY_MS;
  const todayCount = events.filter((e) => dayKey(e.startAt) === todayStr).length;
  const weekCount = events.filter((e) => new Date(e.startAt).getTime() <= weekEnd).length;
  const pending = events.filter((e) => e.status === 'requested').length;
  const waitlistCount = waitlist.filter(
    (w) => w.status === 'active' || w.status === 'offered'
  ).length;

  // Upcoming agenda — the next 7 days, capped and grouped by calendar day.
  const upcoming = events
    .filter((e) => new Date(e.startAt).getTime() <= weekEnd)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, MAX_AGENDA);
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of upcoming) {
    const arr = groups.get(dayKey(e.startAt));
    if (arr) arr.push(e);
    else groups.set(dayKey(e.startAt), [e]);
  }

  // Outcome mix + busiest services from the 30-day report.
  const t = report?.totals;
  const outcomeBars = t
    ? [
        {
          label: 'Completed',
          value: t.completed,
          display: fmtNumber(t.completed),
          color: 'success',
        },
        { label: 'Confirmed', value: t.confirmed, display: fmtNumber(t.confirmed), color: 'info' },
        {
          label: 'Requested',
          value: t.requested,
          display: fmtNumber(t.requested),
          color: 'warning',
        },
        {
          label: 'Cancelled',
          value: t.cancelled,
          display: fmtNumber(t.cancelled),
          color: 'danger',
        },
        { label: 'No-show', value: t.noShow, display: fmtNumber(t.noShow), color: 'neutral' },
      ].filter((o) => o.value > 0)
    : [];
  const serviceBars = (report?.topServices ?? []).map((s) => ({
    label: s.name,
    value: s.count,
    display: fmtNumber(s.count),
    color: 'module',
  }));

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<CalendarClock className="h-5 w-5" />}
          title="Scheduling"
          description="What's on this week and what needs you — appointments, classes, and reservations."
          actions={services.length > 0 ? <NewBookingButton /> : undefined}
        />

        {services.length === 0 ? (
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<CalendarClock className="h-5 w-5" />}
                title="Set up scheduling"
                description="Create a service, add the staff or resources that deliver it, then set their hours — and you're taking bookings."
                actions={
                  <Button color="module" render={<Link href="/scheduling/services" />}>
                    Create your first service
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                }
              />
            </CardBody>
          </Card>
        ) : (
          <>
            {/* Headline KPIs — operational counts (live) + 30-day performance. */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Stat
                icon={<CalendarClock className="h-4 w-4" />}
                label="Today"
                value={fmtNumber(todayCount)}
                hint="bookings today"
              />
              <Stat
                icon={<CalendarDays className="h-4 w-4" />}
                label="Next 7 days"
                value={fmtNumber(weekCount)}
                hint="upcoming bookings"
              />
              <Stat
                icon={<CircleDollarSign className="h-4 w-4" />}
                label="Revenue · 30d"
                value={report ? fmtMoneyCents(report.revenueCents) : '—'}
                hint="completed bookings"
              />
              <Stat
                icon={<AlertTriangle className="h-4 w-4" />}
                label="No-show rate"
                value={report ? `${report.noShowRatePct}%` : '—'}
                hint="last 30 days"
              />
            </div>

            {/* Needs attention — confirmations + waitlist, wired to live counts. */}
            {(pending > 0 || waitlistCount > 0) && (
              <ActionQueue
                title="Needs attention"
                icon={<AlertTriangle className="h-4 w-4" />}
                columns={2}
              >
                <ActionTile
                  asChild
                  icon={<Clock className="h-5 w-5" />}
                  count={fmtNumber(pending)}
                  label="Awaiting confirmation"
                  tone="warning"
                >
                  <Link href="/scheduling/bookings" />
                </ActionTile>
                <ActionTile
                  asChild
                  icon={<Users className="h-5 w-5" />}
                  count={fmtNumber(waitlistCount)}
                  label="On the waitlist"
                  tone="module"
                >
                  <Link href="/scheduling/waitlist" />
                </ActionTile>
              </ActionQueue>
            )}

            {/* Upcoming schedule — the page's primary (tinted) card. */}
            <OverviewCard
              title="Upcoming schedule"
              icon={<CalendarClock className="h-4 w-4" />}
              description="Next 7 days"
              right={<CardLink href="/scheduling/calendar">Open calendar</CardLink>}
            >
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Nothing scheduled"
                  description="No bookings in the next 7 days. New bookings will show up here."
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {[...groups.entries()].map(([key, dayEvents]) => (
                    <div key={key}>
                      <p className="mb-1 text-xs font-medium text-[var(--color-text-tertiary)]">
                        {dayHeading(dayEvents[0]!.startAt)}
                      </p>
                      {dayEvents.map((e) => (
                        <EntityRowLink
                          key={e.id}
                          href={`/scheduling/bookings/${e.id}`}
                          entityType="booking"
                          entityId={e.id}
                          className="-mx-2 flex items-center gap-3 rounded-md border-b border-[var(--color-border-default)] px-2 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--color-bg-subtle)]"
                        >
                          <span className="w-16 shrink-0 text-sm font-medium text-[var(--color-text-secondary)] tabular-nums">
                            {formatTime(e.startAt)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">
                              {e.serviceName}
                            </span>
                            <span className="block truncate text-xs text-[var(--color-text-tertiary)]">
                              {eventMeta(e)}
                            </span>
                          </span>
                          <Badge color={statusColor(e.status as BookingStatus)} variant="soft">
                            {STATUS_LABEL[e.status as BookingStatus] ?? e.status}
                          </Badge>
                        </EntityRowLink>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </OverviewCard>

            {/* Outcome mix + busiest services (last 30 days) — neutral analytics. */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <OverviewCard
                title="Booking outcomes"
                icon={<TrendingUp className="h-4 w-4" />}
                description="How bookings resolved · last 30 days"
                plain
              >
                {outcomeBars.length > 0 ? (
                  <BarList items={outcomeBars} />
                ) : (
                  <EmptyState
                    icon={<TrendingUp className="h-5 w-5" />}
                    title="No bookings yet"
                    description="Outcomes appear here once bookings start completing."
                  />
                )}
              </OverviewCard>

              <OverviewCard
                title="Busiest services"
                icon={<CalendarCheck2 className="h-4 w-4" />}
                description="Most-booked services · last 30 days"
                right={<CardLink href="/scheduling/reports">Reports</CardLink>}
                plain
              >
                {serviceBars.length > 0 ? (
                  <BarList items={serviceBars} />
                ) : (
                  <EmptyState
                    icon={<CalendarCheck2 className="h-5 w-5" />}
                    title="No bookings yet"
                    description="Your most-booked services will rank here."
                  />
                )}
              </OverviewCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
