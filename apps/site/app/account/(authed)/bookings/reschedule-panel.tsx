'use client';

// Inline reschedule picker for one booking (docs/79 §15 Phase 3c). Reuses the
// public availability lookup (loadSlots) and the customer reschedule endpoint;
// the engine's EXCLUDE constraint re-checks the slot on submit, so a slot that
// was taken between load and click surfaces as a clean "no longer available".

import { useState } from 'react';

import { cx, SparxAlert, SparxButton, SparxInput, SparxLabel } from '@sparx/site-ui';

import { loadSlots, type PublicSlot } from '@/lib/scheduling-client';
import { rescheduleMyBooking, type CustomerBooking } from '@/lib/customer-client';

const DAY_MS = 24 * 60 * 60 * 1000;

function slotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Today's date as `yyyy-mm-dd` in the browser's local zone — the min the date
 *  input allows (you can't reschedule into the past). */
function todayLocal(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

interface Props {
  tenantSlug: string;
  booking: CustomerBooking;
  onDone: () => void;
  onClose: () => void;
}

export function ReschedulePanel({ tenantSlug, booking, onDone, onClose }: Props) {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function findSlots(value: string): Promise<void> {
    setDate(value);
    setSlots(null);
    setError(null);
    if (!value) return;
    setLoading(true);
    try {
      // The whole local day → [midnight, next midnight).
      const from = new Date(`${value}T00:00:00`);
      const to = new Date(from.getTime() + DAY_MS);
      const res = await loadSlots(
        tenantSlug,
        booking.serviceId,
        from.toISOString(),
        to.toISOString(),
        booking.partySize ?? undefined
      );
      setSlots(res);
    } catch {
      setError('Could not load available times. Please try another day.');
    } finally {
      setLoading(false);
    }
  }

  async function pick(startAt: string): Promise<void> {
    setSubmitting(startAt);
    setError(null);
    try {
      await rescheduleMyBooking(tenantSlug, booking.id, startAt);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reschedule. The time may be taken.');
      setSubmitting(null);
    }
  }

  return (
    <div
      className="st-card"
      style={{ padding: '1rem', marginTop: '0.5rem', display: 'grid', gap: '0.75rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.9rem' }}>Pick a new time</strong>
        <button type="button" className="st-link" style={{ fontSize: '0.85rem' }} onClick={onClose}>
          Close
        </button>
      </div>

      {error && (
        <SparxAlert color="danger" role="alert">
          {error}
        </SparxAlert>
      )}

      <div>
        <SparxLabel htmlFor={`reschedule-date-${booking.id}`}>Date</SparxLabel>
        <SparxInput
          id={`reschedule-date-${booking.id}`}
          type="date"
          min={todayLocal()}
          value={date}
          onChange={(e) => void findSlots(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="st-skeleton" style={{ height: 64 }} />
      ) : slots === null ? (
        <p className="st-muted" style={{ fontSize: '0.85rem' }}>
          Choose a day to see available times.
        </p>
      ) : slots.length === 0 ? (
        <p className="st-muted" style={{ fontSize: '0.85rem' }}>
          No openings that day — try another date.
        </p>
      ) : (
        <div className="st-booking__slots">
          {slots.map((s) => (
            <button
              key={s.startAt}
              type="button"
              className={cx('st-booking__slot', submitting === s.startAt && 'is-selected')}
              disabled={submitting !== null}
              onClick={() => void pick(s.startAt)}
            >
              {submitting === s.startAt ? 'Moving…' : slotTime(s.startAt)}
            </button>
          ))}
        </div>
      )}

      <div>
        <SparxButton type="button" color="neutral" variant="ghost" onClick={onClose}>
          Keep current time
        </SparxButton>
      </div>
    </div>
  );
}
