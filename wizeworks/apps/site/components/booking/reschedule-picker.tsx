'use client';

// Pick a new time for a booking you already have (docs/79 §15 Phase 3c).
//
// Used from BOTH doors onto a booking — the signed-in account portal and the
// signed link a guest gets in her confirmation (issue 153) — so it takes the
// submit as a prop and knows nothing about which one it is inside. The slot list
// comes from the same public availability lookup the front of the site uses, so
// the times offered here are the times a stranger would be offered, and the
// engine re-checks on submit: a slot taken between load and click comes back as
// a clean refusal in the salon's own words.

import { useState } from 'react';

import { loadSlots, type PublicSlot } from '@/lib/scheduling-client';
import { Alert, Input, Label } from '@wizeworks/silicaui-react';

import { cn } from '@/lib/cn';

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
  booking: { id: string; serviceId: string; partySize: number | null };
  /** Move the booking. Rejecting with an Error shows its message as-is — the
   *  engine's refusals already name the reason (a clash, a closure, nobody
   *  working), so restating them here would only make them vaguer. */
  submit: (startAt: string) => Promise<unknown>;
  onDone: () => void;
  onClose: () => void;
}

export function ReschedulePicker({ tenantSlug, booking, submit, onDone, onClose }: Props) {
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
      setSlots(
        await loadSlots(
          tenantSlug,
          booking.serviceId,
          from.toISOString(),
          to.toISOString(),
          booking.partySize ?? undefined
        )
      );
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
      await submit(startAt);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the time. It may be taken.');
      setSubmitting(null);
    }
  }

  return (
    <div className="card border-base-300 mt-2 grid gap-3 border p-4">
      <div className="flex items-center justify-between">
        <strong className="text-sm">Pick a new time</strong>
        <button type="button" className="link link-primary text-sm" onClick={onClose}>
          Close
        </button>
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <div>
        <Label htmlFor={`reschedule-date-${booking.id}`}>Date</Label>
        <Input
          id={`reschedule-date-${booking.id}`}
          type="date"
          min={todayLocal()}
          value={date}
          onChange={(e) => void findSlots(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="skeleton h-16" />
      ) : slots === null ? (
        <p className="text-base-content text-sm">Choose a day to see available times.</p>
      ) : slots.length === 0 ? (
        <p className="text-base-content text-sm">No openings that day — try another date.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              key={s.startAt}
              type="button"
              className={cn(
                // The same chip the front of the site offers times in, so a
                // customer moving an appointment reads the same shape she booked
                // from rather than a column of full-width rows.
                'rounded-field border-base-300 bg-base-100 text-base-content hover:border-primary cursor-pointer border px-3.5 py-2 text-sm transition-colors',
                submitting === s.startAt && 'border-primary bg-primary text-primary-content'
              )}
              disabled={submitting !== null}
              onClick={() => void pick(s.startAt)}
            >
              {submitting === s.startAt ? 'Moving…' : slotTime(s.startAt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
