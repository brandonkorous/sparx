'use client';

// Customer self-service bookings (docs/79 §15 Phase 3c) — what a SIGNED-IN
// customer sees of her own appointments. The guest who booked without an account
// reaches the same booking through the signed link in her confirmation
// (components/booking/manage-booking.tsx); both go through one server-side view,
// so the two can't offer different rules.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { useCustomer } from '@/components/customer-provider';
import {
  cancelMyBooking,
  getMyBookings,
  rescheduleMyBooking,
  type CustomerBooking,
} from '@/lib/customer-client';

import { AddToCalendar } from '@/components/booking/add-to-calendar';
import { ReschedulePicker } from '@/components/booking/reschedule-picker';

import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

const PAGE_SIZE = 20;

type Scope = 'upcoming' | 'past';

const STATUS_LABEL: Record<string, string> = {
  requested: 'Pending confirmation',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

/** Semantic tone for a booking status — mirrors the STATUS_LABEL set. */
function bookingStatusTone(status: string) {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'cancelled':
    case 'no_show':
      return 'danger';
    default:
      return 'warning';
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BookingsPage() {
  const { tenantSlug } = useCustomer();
  const [scope, setScope] = useState<Scope>('upcoming');
  const [bookings, setBookings] = useState<CustomerBooking[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<string | null>(null);

  const load = useCallback(() => {
    setBookings(null);
    setError(null);
    getMyBookings(tenantSlug, scope, page, PAGE_SIZE)
      .then((res) => {
        setBookings(res.items);
        setTotal(res.total);
      })
      .catch(() => setError('Could not load your bookings.'));
  }, [tenantSlug, scope, page]);

  useEffect(() => {
    load();
  }, [load]);

  function switchScope(next: Scope): void {
    setRescheduling(null);
    setConfirmingCancel(null);
    setPage(1);
    setScope(next);
  }

  async function handleCancel(id: string): Promise<void> {
    setBusy(id);
    setError(null);
    try {
      await cancelMyBooking(tenantSlug, id);
      setConfirmingCancel(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel the booking. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  function onRescheduled(): void {
    setRescheduling(null);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">My bookings</h1>
        {/* The label is the Button's CHILDREN. Putting it inside the render
            element instead drew a correctly styled anchor with nothing in it —
            a blank square, and the only thing to click on an empty page (issue 154). */}
        <Button color="primary" render={<Link href="/book" />}>
          Book an appointment
        </Button>
      </div>

      <div role="tablist" className="mb-5 flex gap-2">
        {(['upcoming', 'past'] as const).map((s) => (
          <Button
            key={s}
            type="button"
            color="primary"
            variant={scope === s ? 'solid' : 'ghost'}
            onClick={() => switchScope(s)}
          >
            {s === 'upcoming' ? 'Upcoming' : 'Past'}
          </Button>
        ))}
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : bookings === null ? (
        <div className="skeleton h-[200px]" />
      ) : bookings.length === 0 ? (
        <div className="card border-base-300 border p-8 text-center">
          <p className="text-base-content">
            {scope === 'upcoming' ? 'You have no upcoming bookings.' : 'No past bookings.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {bookings.map((b) => (
              <div key={b.id}>
                <div className="card border-base-300 flex flex-wrap items-start justify-between gap-4 border px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <strong>{b.serviceName}</strong>
                    <div className="text-base-content mt-1 text-sm">
                      {formatDateTime(b.startAt)} · {b.durationMinutes} min
                    </div>
                    {b.staff.length > 0 && (
                      <div className="text-base-content text-sm">With {b.staff.join(', ')}</div>
                    )}
                    {b.cancellationReason && (
                      <div className="text-base-content mt-1 text-sm">
                        Reason: {b.cancellationReason}
                      </div>
                    )}
                    {b.calendar && (
                      <AddToCalendar links={b.calendar} className="mt-2 !justify-start text-sm" />
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                    <Badge color={bookingStatusTone(b.status)} variant="soft">
                      {STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                    {b.canReschedule && (
                      <Button
                        type="button"
                        color="primary"
                        variant="outline"
                        size="sm"
                        onClick={() => setRescheduling(rescheduling === b.id ? null : b.id)}
                      >
                        {rescheduling === b.id ? 'Keep this time' : 'Reschedule'}
                      </Button>
                    )}
                    {b.canCancel && (
                      <Button
                        type="button"
                        color="danger"
                        variant="ghost"
                        size="sm"
                        disabled={busy === b.id}
                        onClick={() => setConfirmingCancel(b.id)}
                      >
                        {busy === b.id ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    )}
                  </div>
                </div>
                {/* Names the appointment rather than saying "this booking" — the
                    same rule as issue 142, on the customer's side of it. */}
                {confirmingCancel === b.id && (
                  <Alert color="warning" role="alertdialog" className="mt-2 flex-col items-start">
                    <p>
                      Cancel {b.serviceName} on {formatDateTime(b.startAt)}? The time goes back to
                      whoever wants it, and this cannot be undone.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        color="danger"
                        size="sm"
                        disabled={busy === b.id}
                        onClick={() => void handleCancel(b.id)}
                      >
                        {busy === b.id ? 'Cancelling…' : 'Yes, cancel it'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(null)}>
                        Keep the appointment
                      </Button>
                    </div>
                  </Alert>
                )}
                {rescheduling === b.id && (
                  <ReschedulePicker
                    tenantSlug={tenantSlug}
                    booking={b}
                    submit={(startAt) => rescheduleMyBooking(tenantSlug, b.id, startAt)}
                    onDone={onRescheduled}
                    onClose={() => setRescheduling(null)}
                  />
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex justify-between">
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-base-content self-center text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
