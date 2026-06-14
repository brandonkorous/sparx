'use client';

// B2B portal — appointments list for one account.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import {
  getB2bAppointments,
  cancelB2bAppointment,
  type B2bAppointmentEntry,
} from '@/lib/customer-client';

const PAGE_SIZE = 20;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function vehicleLabel(ref: Record<string, unknown> | null): string | null {
  if (!ref) return null;
  const parts = [ref.year, ref.make, ref.model].filter(Boolean);
  return parts.length > 0 ? String(parts.join(' ')) : null;
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function B2bAppointmentsPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [appointments, setAppointments] = useState<B2bAppointmentEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  function load() {
    setAppointments(null);
    setError(null);
    getB2bAppointments(tenantSlug, accountId, skip, PAGE_SIZE)
      .then((res) => {
        setAppointments(res.items);
        setTotal(res.total);
      })
      .catch(() => setError('Could not load appointments.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, accountId, skip]);

  async function handleCancel(apptId: string) {
    if (!confirm('Cancel this appointment?')) return;
    setCancelling(apptId);
    try {
      await cancelB2bAppointment(tenantSlug, accountId, apptId);
      load();
    } catch {
      alert('Could not cancel the appointment. Please try again.');
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <Link href={`/account/b2b/${accountId}`} className="st-link" style={{ fontSize: '0.9rem' }}>
          ← Back
        </Link>
        <h1 className="st-h2">Appointments</h1>
      </div>

      {error ? (
        <div className="st-alert st-alert--error" role="alert">
          {error}
        </div>
      ) : appointments === null ? (
        <div className="st-skeleton" style={{ height: 200 }} />
      ) : appointments.length === 0 ? (
        <div className="st-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="st-muted">No appointments found on this account.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {appointments.map((a) => {
              const canCancel = a.status === 'requested' || a.status === 'confirmed';
              return (
                <div
                  key={a.id}
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
                  <div style={{ flex: 1 }}>
                    <strong>{a.serviceTypeName ?? 'Appointment'}</strong>
                    <div className="st-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      {formatDateTime(a.scheduledAt)} · {a.durationMinutes} min
                    </div>
                    {vehicleLabel(a.vehicleRef) && (
                      <div className="st-muted" style={{ fontSize: '0.82rem' }}>
                        {vehicleLabel(a.vehicleRef)}
                      </div>
                    )}
                    {a.notes && (
                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{a.notes}</div>
                    )}
                    {a.cancellationReason && (
                      <div
                        className="st-muted"
                        style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}
                      >
                        Reason: {a.cancellationReason}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      flexShrink: 0,
                    }}
                  >
                    <span className="st-badge" data-status={a.status}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    {canCancel && (
                      <button
                        type="button"
                        className="st-btn st-btn--ghost"
                        style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem' }}
                        disabled={cancelling === a.id}
                        onClick={() => void handleCancel(a.id)}
                      >
                        {cancelling === a.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button
                type="button"
                className="st-btn st-btn--outline"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </button>
              <span className="st-muted" style={{ fontSize: '0.85rem', lineHeight: '2.25rem' }}>
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
              </span>
              <button
                type="button"
                className="st-btn st-btn--outline"
                disabled={skip + PAGE_SIZE >= total}
                onClick={() => setSkip(skip + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
