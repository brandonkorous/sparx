'use client';

// Customer self-service bookings (docs/79 §15 Phase 3c) — the page the booking
// confirmation/reminder emails' "Manage booking" link points at. Signed-in
// customers see their own bookings and can cancel or reschedule the upcoming ones.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { useCustomer } from '@/components/customer-provider';
import { cancelMyBooking, getMyBookings, type CustomerBooking } from '@/lib/customer-client';

import { AddToCalendar } from '@/components/booking/add-to-calendar';

import { ReschedulePanel } from './reschedule-panel';
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
      return 'danger';
    case 'no_show':
      return 'neutral';
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
    setPage(1);
    setScope(next);
  }

  async function handleCancel(id: string): Promise<void> {
    if (!confirm('Cancel this booking? This cannot be undone.')) return;
    setBusy(id);
    try {
      await cancelMyBooking(tenantSlug, id);
      load();
    } catch {
      alert('Could not cancel the booking. Please try again.');
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">My bookings</h1>
        <Button
          type="button"
          color="primary"
          render={<Link href="/book">Book an appointment</Link>}
        />
      </div>

      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
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
        <div className="skeleton" style={{ height: 200 }} />
      ) : bookings.length === 0 ? (
        <div
          className="card border-base-300 border"
          style={{ padding: '2rem', textAlign: 'center' }}
        >
          <p className="text-base-content">
            {scope === 'upcoming' ? 'You have no upcoming bookings.' : 'No past bookings.'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {bookings.map((b) => (
              <div key={b.id}>
                <div
                  className="card border-base-300 border"
                  style={{
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{b.serviceName}</strong>
                    <div
                      className="text-base-content"
                      style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}
                    >
                      {formatDateTime(b.startAt)} · {b.durationMinutes} min
                    </div>
                    {b.staff.length > 0 && (
                      <div className="text-base-content" style={{ fontSize: '0.82rem' }}>
                        With {b.staff.join(', ')}
                      </div>
                    )}
                    {b.cancellationReason && (
                      <div
                        className="text-base-content"
                        style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}
                      >
                        Reason: {b.cancellationReason}
                      </div>
                    )}
                    {b.calendar && (
                      <AddToCalendar
                        links={b.calendar}
                        className="mt-2 !justify-start text-[0.82rem]"
                      />
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      flexShrink: 0,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Badge color={bookingStatusTone(b.status)} variant="soft">
                      {STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                    {b.canReschedule && (
                      <Button
                        type="button"
                        color="primary"
                        variant="outline"
                        style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => setRescheduling(rescheduling === b.id ? null : b.id)}
                      >
                        {rescheduling === b.id ? 'Cancel' : 'Reschedule'}
                      </Button>
                    )}
                    {b.canCancel && (
                      <Button
                        type="button"
                        color="neutral"
                        variant="ghost"
                        style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem' }}
                        disabled={busy === b.id}
                        onClick={() => void handleCancel(b.id)}
                      >
                        {busy === b.id ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    )}
                  </div>
                </div>
                {rescheduling === b.id && (
                  <ReschedulePanel
                    tenantSlug={tenantSlug}
                    booking={b}
                    onDone={onRescheduled}
                    onClose={() => setRescheduling(null)}
                  />
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span
                className="text-base-content"
                style={{ fontSize: '0.85rem', lineHeight: '2.25rem' }}
              >
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
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
