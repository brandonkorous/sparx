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
//
// The day and the times are the BUSINESS's, on the booking's own clock (sparx
// persona issue 086). They were the reader's: the day ran from the reader's
// midnight and the times were printed on the reader's clock, so somebody two
// zones away picked "9:00" and arrived at 11:00. The booking page and the
// confirmation already said the shop's time; this was the one place that did not.

import { useState } from 'react';

import { loadSlots, type PublicSlot } from '@/lib/scheduling-client';
import { Alert, Button, Input, Label } from '@wizeworks/silicaui-react';

import {
  dayAfter,
  formatTime,
  isBookableDay,
  readsTheSame,
  startOfDay,
  today,
  zoneName,
} from './booking-clock';

interface Props {
  tenantSlug: string;
  booking: { id: string; serviceId: string; partySize: number | null; timezone: string };
  /** Move the booking. Rejecting with an Error shows its message as-is — the
   *  engine's refusals already name the reason (a clash, a closure, nobody
   *  working), so restating them here would only make them vaguer. */
  submit: (startAt: string) => Promise<unknown>;
  onDone: () => void;
  onClose: () => void;
}

export function ReschedulePicker({ tenantSlug, booking, submit, onDone, onClose }: Props) {
  const tz = booking.timezone || null;
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function findSlots(value: string): Promise<void> {
    setDate(value);
    setSlots(null);
    setError(null);
    // A box still being typed into ("0002-08-25" on the way to 2026) asks nothing.
    if (!isBookableDay(value, tz)) return;
    setLoading(true);
    try {
      // The whole of that day where the business is: [its midnight, the next one).
      setSlots(
        await loadSlots(
          tenantSlug,
          booking.serviceId,
          startOfDay(value, tz).toISOString(),
          startOfDay(dayAfter(value), tz).toISOString(),
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
          min={today(tz)}
          value={date}
          onChange={(e) => void findSlots(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="skeleton h-16" />
      ) : slots === null ? (
        <p className="text-base-content text-sm">Choose a day to see available times.</p>
      ) : slots.length === 0 ? (
        <p className="text-base-content text-sm">No openings that day. Try another date.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              // The same button the booking page offers times in, so a customer
              // moving an appointment reads the same shape they booked from.
              <Button
                key={s.startAt}
                type="button"
                size="sm"
                color="primary"
                variant={submitting === s.startAt ? 'solid' : 'outline'}
                disabled={submitting !== null}
                onClick={() => void pick(s.startAt)}
              >
                {submitting === s.startAt ? 'Moving…' : formatTime(s.startAt, tz)}
              </Button>
            ))}
          </div>
          {tz && slots[0] && !readsTheSame(slots[0].startAt, tz) ? (
            <p className="text-base-content text-sm">
              Times are the business&rsquo;s local time ({zoneName(slots[0].startAt, tz)}).
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
