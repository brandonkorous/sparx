'use client';

// One appointment, and what its owner can do with it — reached by the signed
// link in her confirmation, with no account (issue 153).
//
// The page states the appointment in full first (what, when, who with, where)
// because a person following a link out of an email needs to know she is looking
// at the right one before she changes anything. Only then does it offer the two
// things her salon's own page promised her: change it, or call it off.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { useCustomer } from '@/components/customer-provider';
import { AddToCalendar } from '@/components/booking/add-to-calendar';
import { ReschedulePicker } from '@/components/booking/reschedule-picker';
import {
  cancelManagedBooking,
  loadManagedBooking,
  rescheduleManagedBooking,
  type ManagedBooking,
} from '@/lib/scheduling-client';
import { Alert, Badge, Button, Heading, Text } from '@wizeworks/silicaui-react';

/** What each state means to the person who booked, in her words rather than the
 *  engine's. `requested` is the one that needs saying out loud: she has asked,
 *  and the salon has not answered yet. */
const STATE: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  requested: { label: 'Waiting to be confirmed', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  in_progress: { label: 'Happening now', tone: 'info' },
  completed: { label: 'Done', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  no_show: { label: 'Missed', tone: 'danger' },
};

/** The appointment's time on the BUSINESS's clock, and said so. A customer
 *  booking from another city must not be shown her own (issue 109). */
function whenText(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  });
}

export function ManageBooking({ token }: { token: string }) {
  const { tenantSlug } = useCustomer();
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [failed, setFailed] = useState(false);
  const [moving, setMoving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);

  const load = useCallback(() => {
    loadManagedBooking(token)
      .then(setBooking)
      .catch(() => setFailed(true));
  }, [token]);

  useEffect(load, [load]);

  async function doCancel(): Promise<void> {
    setCancelling(true);
    setError(null);
    // The "moved" notice is about the state BEFORE this. Leaving it standing put
    // "your appointment has been moved" directly above a cancelled appointment.
    setMoved(false);
    try {
      setBooking(await cancelManagedBooking(token));
      setConfirmingCancel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel it. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  // A dead link says what to do about it. It is almost always an old email, and
  // the person still wants an appointment — so the way forward is a booking
  // page, not an apology.
  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <Heading level={1} className="text-2xl font-semibold">
          This link no longer works
        </Heading>
        <Text>
          It may be from an older email, or the appointment it pointed at may have been removed.
          Check your most recent confirmation, or book a new time below.
        </Text>
        <div>
          <Button color="primary" render={<Link href="/book" />}>
            Book an appointment
          </Button>
        </div>
      </div>
    );
  }

  if (!booking) return <div className="skeleton h-48" />;

  const state = STATE[booking.status] ?? { label: booking.status, tone: 'info' as const };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading level={1} className="text-2xl font-semibold">
            {booking.serviceName}
          </Heading>
          <Text className="text-base">{whenText(booking.startAt, booking.timezone)}</Text>
          <Text className="text-sm">
            {booking.durationMinutes} min
            {booking.staff.length > 0 ? ` · with ${booking.staff.join(', ')}` : ''}
          </Text>
          {booking.where ? (
            <address className="text-base-content text-sm not-italic">{booking.where}</address>
          ) : null}
        </div>
        <Badge color={state.tone} variant="soft" className="shrink-0">
          {state.label}
        </Badge>
      </div>

      {moved ? (
        <Alert color="success" role="status">
          Your appointment has been moved. A confirmation is on its way.
        </Alert>
      ) : null}

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      {booking.status === 'cancelled' ? (
        <div className="flex flex-col items-start gap-3">
          <Text>
            {booking.cancellationReason
              ? `This appointment is cancelled: ${booking.cancellationReason}`
              : 'This appointment is cancelled.'}
          </Text>
          <Button color="primary" render={<Link href="/book" />}>
            Book another time
          </Button>
        </div>
      ) : null}

      {booking.calendar ? <AddToCalendar links={booking.calendar} /> : null}

      {booking.canReschedule || booking.canCancel ? (
        <div className="border-base-300 flex flex-col gap-3 border-t pt-6">
          <div className="flex flex-wrap gap-3">
            {booking.canReschedule ? (
              <Button
                color="primary"
                onClick={() => {
                  setMoved(false);
                  setMoving((open) => !open);
                }}
              >
                {moving ? 'Keep this time' : 'Change the time'}
              </Button>
            ) : null}
            {booking.canCancel ? (
              <Button
                color="danger"
                variant="outline"
                onClick={() => {
                  setMoved(false);
                  setConfirmingCancel(true);
                }}
                disabled={cancelling}
              >
                Cancel this appointment
              </Button>
            ) : null}
          </div>

          {/* Named, not "this booking" — the person is acting on one line in an
              email and should see exactly what she is about to lose (issue 142). */}
          {confirmingCancel ? (
            <Alert color="warning" role="alertdialog" className="flex-col items-start gap-3">
              <Text>
                Cancel {booking.serviceName} on {whenText(booking.startAt, booking.timezone)}? The
                time goes back to whoever wants it, and this cannot be undone.
              </Text>
              <div className="flex flex-wrap gap-2">
                <Button color="danger" onClick={() => void doCancel()} disabled={cancelling}>
                  {cancelling ? 'Cancelling…' : 'Yes, cancel it'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingCancel(false)}>
                  Keep the appointment
                </Button>
              </div>
            </Alert>
          ) : null}

          {moving ? (
            <ReschedulePicker
              tenantSlug={tenantSlug}
              booking={booking}
              submit={(startAt) => rescheduleManagedBooking(token, startAt)}
              onDone={() => {
                setMoving(false);
                setMoved(true);
                load();
              }}
              onClose={() => setMoving(false)}
            />
          ) : null}
        </div>
      ) : (
        // Past, in progress, or already dealt with. Say WHY there is nothing to
        // press rather than leaving a page with no buttons on it.
        <Text className="text-sm">
          {booking.status === 'cancelled'
            ? null
            : 'This appointment can no longer be changed here. Give us a call if you need to.'}
        </Text>
      )}
    </div>
  );
}
