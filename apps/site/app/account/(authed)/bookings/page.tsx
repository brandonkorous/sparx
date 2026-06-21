'use client';

// Customer self-service bookings (docs/79 §15 Phase 3c) — the page the booking
// confirmation/reminder emails' "Manage booking" link points at. Signed-in
// customers see their own bookings and can cancel or reschedule the upcoming ones.

import { useCallback, useEffect, useState } from 'react';

import { SparxAlert, SparxButton } from '@sparx/site-ui';

import { useCustomer } from '@/components/customer-provider';
import { cancelMyBooking, getMyBookings, type CustomerBooking } from '@/lib/customer-client';

import { AddToCalendar } from '@/components/booking/add-to-calendar';

import { ReschedulePanel } from './reschedule-panel';

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
      <h1 className="st-h2" style={{ marginBottom: '1rem' }}>
        My bookings
      </h1>

      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {(['upcoming', 'past'] as const).map((s) => (
          <SparxButton
            key={s}
            type="button"
            color="primary"
            variant={scope === s ? 'solid' : 'ghost'}
            onClick={() => switchScope(s)}
          >
            {s === 'upcoming' ? 'Upcoming' : 'Past'}
          </SparxButton>
        ))}
      </div>

      {error ? (
        <SparxAlert color="danger" role="alert">
          {error}
        </SparxAlert>
      ) : bookings === null ? (
        <div className="st-skeleton" style={{ height: 200 }} />
      ) : bookings.length === 0 ? (
        <div className="st-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="st-muted">
            {scope === 'upcoming' ? 'You have no upcoming bookings.' : 'No past bookings.'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {bookings.map((b) => (
              <div key={b.id}>
                <div
                  className="st-card"
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
                    <div className="st-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      {formatDateTime(b.startAt)} · {b.durationMinutes} min
                    </div>
                    {b.staff.length > 0 && (
                      <div className="st-muted" style={{ fontSize: '0.82rem' }}>
                        With {b.staff.join(', ')}
                      </div>
                    )}
                    {b.cancellationReason && (
                      <div
                        className="st-muted"
                        style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}
                      >
                        Reason: {b.cancellationReason}
                      </div>
                    )}
                    {b.calendar && (
                      <AddToCalendar links={b.calendar} className="st-add-to-cal--start" />
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
                    <span className="st-badge" data-status={b.status}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                    {b.canReschedule && (
                      <SparxButton
                        type="button"
                        color="primary"
                        variant="outline"
                        style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => setRescheduling(rescheduling === b.id ? null : b.id)}
                      >
                        {rescheduling === b.id ? 'Cancel' : 'Reschedule'}
                      </SparxButton>
                    )}
                    {b.canCancel && (
                      <SparxButton
                        type="button"
                        color="neutral"
                        variant="ghost"
                        style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem' }}
                        disabled={busy === b.id}
                        onClick={() => void handleCancel(b.id)}
                      >
                        {busy === b.id ? 'Cancelling…' : 'Cancel'}
                      </SparxButton>
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
              <SparxButton
                type="button"
                color="primary"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </SparxButton>
              <span className="st-muted" style={{ fontSize: '0.85rem', lineHeight: '2.25rem' }}>
                Page {page} of {totalPages}
              </span>
              <SparxButton
                type="button"
                color="primary"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </SparxButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
