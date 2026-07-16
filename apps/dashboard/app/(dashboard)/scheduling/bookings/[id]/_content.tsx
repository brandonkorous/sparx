import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Clock,
  CreditCard,
  History,
  MapPin,
  Repeat,
  Tag,
  Timer,
  User,
  Users,
} from 'lucide-react';

import { Badge, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { Stat, Timeline, TimelineItem, TimelineTime, TimelineTitle } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import type { Booking } from '../../_lib/types';
import {
  BOOKING_TYPE_LABEL,
  duration,
  formatDate,
  formatDateTime,
  formatTime,
  money,
} from '../../_lib/format';
import { BookingDetailActions } from './_components/booking-detail-actions';
import { BookingNotesCard } from './_components/booking-notes-card';

// Booking detail — the record behind a calendar block or a bookings-list row,
// mounted by both the full-page route ([id]/page.tsx) and the dashboard shell's
// drawer / modal panel. A read-only/transaction detail: it keeps its identity
// heading (service + time) and teleports status + lifecycle actions into the
// frame header (docs/86 §5.1). Staff edits (notes) + reschedule live inline.

export const dynamic = 'force-dynamic';

interface CustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

// Per-customer reliability (GET .../customers/:id/booking-stats) — the
// "problematic client" signal surfaced inline on this booking.
interface CustomerBookingStats {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  upcoming: number;
  noShowRatePct: number;
}

// Flag a genuinely unreliable customer: repeated no-shows AND a high rate (not a
// one-off, not a new customer's single miss).
function isUnreliable(s: CustomerBookingStats): boolean {
  return s.noShow >= 2 && s.noShowRatePct >= 25;
}

const DEPOSIT: Record<
  string,
  { label: string; color: 'module' | 'success' | 'neutral' | 'danger' }
> = {
  held: { label: 'Hold placed', color: 'module' },
  captured: { label: 'Paid', color: 'success' },
  refunded: { label: 'Released', color: 'neutral' },
  forfeited: { label: 'Forfeited', color: 'danger' },
};

interface TimelineEvent {
  key: string;
  title: string;
  when: string;
  detail?: string;
}

// The booking lifecycle audit trail (GET .../timeline). Includes what a reschedule
// MOVED (old → new), which the booking row no longer remembers.
interface BookingTimelineEntry {
  id: string;
  action: string;
  diff: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  'booking.created': 'Booked',
  'booking.confirmed': 'Confirmed',
  'booking.rescheduled': 'Rescheduled',
  'booking.cancelled': 'Cancelled',
  'booking.checked_in': 'Checked in',
  'booking.completed': 'Completed',
  'booking.no_show': 'Marked no-show',
};

function rescheduleDetail(from: string, to: string, tz: string): string {
  const sameDay = new Date(from).toDateString() === new Date(to).toDateString();
  return sameDay
    ? `${formatDate(from, tz)} · ${formatTime(from, tz)} → ${formatTime(to, tz)}`
    : `${formatDateTime(from, tz)} → ${formatDateTime(to, tz)}`;
}

function mapTimeline(entries: BookingTimelineEntry[], tz: string): TimelineEvent[] {
  return entries.map((e) => {
    const d = e.diff ?? {};
    let detail: string | undefined;
    if (
      e.action === 'booking.rescheduled' &&
      typeof d.fromStartAt === 'string' &&
      typeof d.toStartAt === 'string'
    ) {
      detail = rescheduleDetail(d.fromStartAt, d.toStartAt, tz);
    } else if (e.action === 'booking.cancelled' && typeof d.reason === 'string') {
      detail = d.reason;
    } else if (e.action === 'booking.created' && typeof d.source === 'string') {
      detail = `via ${d.source}`;
    }
    return {
      key: e.id,
      title: ACTION_LABEL[e.action] ?? e.action,
      when: formatDateTime(e.createdAt, tz),
      detail,
    };
  });
}

// Fallback for bookings created before the audit trail existed: derive milestones
// from the lifecycle timestamps on the row (oldest first).
function timelineOf(b: Booking): TimelineEvent[] {
  const tz = b.timezone;
  const entries: { key: string; title: string; at: string; detail?: string }[] = [
    { key: 'created', title: 'Booked', at: b.createdAt, detail: `via ${b.source}` },
  ];
  if (b.confirmedAt) entries.push({ key: 'confirmed', title: 'Confirmed', at: b.confirmedAt });
  if (b.checkedInAt) entries.push({ key: 'checkedIn', title: 'Checked in', at: b.checkedInAt });
  if (b.completedAt) entries.push({ key: 'completed', title: 'Completed', at: b.completedAt });
  if (b.cancelledAt)
    entries.push({
      key: 'cancelled',
      title: 'Cancelled',
      at: b.cancelledAt,
      detail: b.cancellationReason ?? undefined,
    });
  if (b.noShowAt) entries.push({ key: 'noShow', title: 'Marked no-show', at: b.noShowAt });
  return entries
    .sort((a, c) => a.at.localeCompare(c.at))
    .map((e) => ({ key: e.key, title: e.title, when: formatDateTime(e.at, tz), detail: e.detail }));
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-row items-start gap-3">
      <span className="text-base-content mt-0.5">{icon}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-base-content text-xs">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

export async function BookingDetailContent({ id }: { id: string }) {
  let booking: Booking;
  try {
    booking = await api.get<Booking>(`/v1/scheduling/bookings/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const [customer, timeline, custStats] = await Promise.all([
    booking.customerId
      ? api.get<CustomerSummary>(`/v1/crm/customers/${booking.customerId}`).catch(() => null)
      : Promise.resolve(null),
    api
      .get<BookingTimelineEntry[]>(`/v1/scheduling/bookings/${booking.id}/timeline`)
      .catch(() => [] as BookingTimelineEntry[]),
    booking.customerId
      ? api
          .get<CustomerBookingStats>(`/v1/scheduling/customers/${booking.customerId}/booking-stats`)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const tz = booking.timezone;
  const customerName = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      (customer.company ?? customer.email ?? 'Customer')
    : (booking.attendees.find((a) => a.guestName)?.guestName ?? null);
  const staffNames = booking.resources.map((r) => r.resource.name).filter(Boolean);
  const mins = Math.round(
    (new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / 60000
  );
  const deposit = booking.depositStatus ? DEPOSIT[booking.depositStatus] : undefined;
  // Prefer the real audit trail (shows reschedules); fall back to row timestamps
  // for bookings created before the trail existed.
  const events = timeline.length > 0 ? mapTimeline(timeline, tz) : timelineOf(booking);

  return (
    // @container so the body responds to its OWN width — the same content mounts
    // in a narrow drawer and a wide full page; viewport breakpoints can't tell
    // them apart, container queries can (matches commerce/products/[id]).
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{booking.service.name}</h1>
          <Badge color="module" variant="soft" size="sm">
            {BOOKING_TYPE_LABEL[booking.bookingType]}
          </Badge>
          {booking.seriesId && (
            <Link
              href="/scheduling/series"
              className="hover:text-module inline-flex items-center gap-1 text-sm hover:underline"
            >
              <Repeat className="h-3.5 w-3.5" /> Recurring series
            </Link>
          )}
        </div>
        <p className="text-base-content text-base">
          {formatDate(booking.startAt, tz)} · {formatTime(booking.startAt, tz)} –{' '}
          {formatTime(booking.endAt, tz)}
        </p>
      </div>

      <BookingDetailActions
        id={booking.id}
        status={booking.status}
        bookingType={booking.bookingType}
        serviceId={booking.serviceId}
        startAt={booking.startAt}
      />

      {/* Bare Stat tiles — the Stat IS the tile (rounded, tinted-icon chip); no
          Card wrapper (that was a card-in-card). Module hue rides the icon chips. */}
      <div className="grid grid-cols-1 gap-4 @[420px]:grid-cols-2 @[760px]:grid-cols-4">
        <Stat
          icon={<CalendarDays className="h-4 w-4" />}
          label="Date"
          value={formatDate(booking.startAt, tz)}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Time"
          value={`${formatTime(booking.startAt, tz)} – ${formatTime(booking.endAt, tz)}`}
        />
        <Stat icon={<Timer className="h-4 w-4" />} label="Duration" value={duration(mins)} />
        <Stat
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="Price"
          value={
            booking.service.priceCents > 0
              ? money(booking.service.priceCents, booking.service.currency)
              : 'Free'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 @[820px]:grid-cols-3">
        <div className="flex flex-col gap-6 @[820px]:col-span-2">
          <Card>
            <CardBody>
              <CardTitle>Details</CardTitle>
              <div className="grid gap-5 @[480px]:grid-cols-2">
                <Field icon={<User className="h-4 w-4" />} label="Customer">
                  {customer ? (
                    <Link
                      href={`/crm/customers/${customer.id}`}
                      className="hover:text-module hover:underline"
                    >
                      {customerName}
                    </Link>
                  ) : (
                    (customerName ?? <span className="text-base-content">—</span>)
                  )}
                </Field>
                {custStats && custStats.total > 0 ? (
                  <Field icon={<History className="h-4 w-4" />} label="Customer reliability">
                    <div className="flex flex-row flex-wrap items-center gap-2">
                      <span>
                        {custStats.completed} kept · {custStats.noShow} no-show ·{' '}
                        {custStats.cancelled} cancelled
                      </span>
                      {isUnreliable(custStats) && (
                        <Badge color="warning" variant="soft" size="sm">
                          High no-show rate
                        </Badge>
                      )}
                    </div>
                  </Field>
                ) : null}
                <Field icon={<Users className="h-4 w-4" />} label="Staff / resources">
                  {staffNames.length ? (
                    staffNames.join(', ')
                  ) : (
                    <span className="text-base-content">Unassigned</span>
                  )}
                </Field>
                {booking.partySize ? (
                  <Field icon={<Users className="h-4 w-4" />} label="Party size">
                    {booking.partySize}
                  </Field>
                ) : null}
                <Field icon={<CalendarClock className="h-4 w-4" />} label="Type">
                  {BOOKING_TYPE_LABEL[booking.bookingType]}
                </Field>
                {deposit ? (
                  <Field icon={<CreditCard className="h-4 w-4" />} label="Deposit">
                    <Badge color={deposit.color} variant="soft" size="sm">
                      {deposit.label}
                    </Badge>
                  </Field>
                ) : null}
                <Field icon={<Tag className="h-4 w-4" />} label="Source">
                  <span className="capitalize">{booking.source}</span>
                </Field>
                {booking.locationId ? (
                  <Field icon={<MapPin className="h-4 w-4" />} label="Location">
                    {booking.locationId}
                  </Field>
                ) : null}
                <Field icon={<Clock className="h-4 w-4" />} label="Created">
                  {formatDateTime(booking.createdAt, tz)}
                </Field>
              </div>
            </CardBody>
          </Card>

          <BookingNotesCard id={booking.id} notes={booking.notes} staffNotes={booking.staffNotes} />
        </div>

        <Card>
          <CardBody>
            <CardTitle>
              <div className="flex flex-row items-center gap-2">
                <History className="h-4 w-4" /> History
              </div>
            </CardTitle>
            <Timeline>
              {events.map((e, i) => (
                <TimelineItem key={e.key} showConnector={i < events.length - 1}>
                  <TimelineTitle>{e.title}</TimelineTitle>
                  <TimelineTime>{e.when}</TimelineTime>
                  {e.detail && <p className="text-base-content text-xs">{e.detail}</p>}
                </TimelineItem>
              ))}
            </Timeline>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
