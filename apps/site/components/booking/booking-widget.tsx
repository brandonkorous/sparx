'use client';

// Customer booking widget (docs/79 §13). Pick a date → see open times for the
// service → enter contact details → book. Runs entirely in the browser against
// the public scheduling surface via the /api/sparx proxy; the slot list is what
// the engine's no-overlap guarantee will accept, so a confirmed time is real.

import { useCallback, useEffect, useState } from 'react';

import { cx, SparxAlert, SparxButton, SparxInput, SparxLabel } from '@sparx/site-ui';

import type { PublicService } from '../../lib/scheduling';
import {
  createPublicBooking,
  loadSlots,
  type BookingConfirmation,
  type PublicSlot,
} from '../../lib/scheduling-client';
import { BookingDepositStep } from './booking-deposit-step';
import { AddToCalendar } from './add-to-calendar';

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso)
  );
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function BookingWidget({
  tenantSlug,
  service,
}: {
  tenantSlug: string;
  service: PublicService;
}) {
  const isReservation = service.bookingType === 'reservation';
  const [date, setDate] = useState(todayISODate());
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  // A booking created but awaiting its deposit/hold payment (docs/79 §9).
  const [pendingDeposit, setPendingDeposit] = useState<BookingConfirmation | null>(null);

  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true);
    setSelected(null);
    setError(null);
    try {
      const from = new Date(`${date}T00:00`);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      const result = await loadSlots(
        tenantSlug,
        service.id,
        from.toISOString(),
        to.toISOString(),
        isReservation ? partySize : undefined
      );
      setSlots(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load availability.');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [tenantSlug, service.id, date, partySize, isReservation]);

  useEffect(() => {
    void fetchSlots();
  }, [fetchSlots]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Please choose a time.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createPublicBooking(tenantSlug, {
        serviceId: service.id,
        startAt: selected,
        ...(isReservation ? { partySize } : {}),
        customer: {
          name: name.trim(),
          email: email.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      // A deposit/hold-required service returns a clientSecret to collect before
      // the booking is secured; otherwise it's confirmed outright.
      if (result.deposit?.clientSecret) {
        setPendingDeposit(result);
      } else {
        setConfirmation(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the booking.');
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingDeposit?.deposit) {
    return (
      <BookingDepositStep
        clientSecret={pendingDeposit.deposit.clientSecret}
        amountCents={pendingDeposit.deposit.amountCents}
        type={pendingDeposit.deposit.type}
        serviceName={pendingDeposit.serviceName}
        onPaid={() => {
          setConfirmation(pendingDeposit);
          setPendingDeposit(null);
        }}
      />
    );
  }

  if (confirmation) {
    return (
      <div className="st-card st-booking__confirm" role="status">
        <h2 className="st-h3">
          {confirmation.requiresApproval ? 'Request received' : "You're booked"}
        </h2>
        <p className="st-muted">
          {confirmation.requiresApproval
            ? `We've received your request for ${confirmation.serviceName} on ${formatDateTime(confirmation.startAt)}. You'll get a confirmation once it's approved.`
            : `${confirmation.serviceName} is confirmed for ${formatDateTime(confirmation.startAt)}. A confirmation is on its way to ${email}.`}
        </p>
        {confirmation.calendar ? <AddToCalendar links={confirmation.calendar} /> : null}
      </div>
    );
  }

  return (
    <form className="st-booking" onSubmit={submit}>
      <div className="st-booking__row">
        <div>
          <SparxLabel htmlFor="book-date">Date</SparxLabel>
          <SparxInput
            id="book-date"
            type="date"
            min={todayISODate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {isReservation ? (
          <div>
            <SparxLabel htmlFor="book-party">Party size</SparxLabel>
            <SparxInput
              id="book-party"
              type="number"
              min={1}
              value={partySize}
              onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        ) : null}
      </div>

      <div className="st-booking__slots">
        <SparxLabel>Available times</SparxLabel>
        {loadingSlots ? (
          <p className="st-muted">Checking availability…</p>
        ) : slots?.length === 0 ? (
          <p className="st-muted">No open times that day — try another date.</p>
        ) : (
          <div className="st-booking__slot-grid">
            {(slots ?? []).map((slot) => (
              <button
                key={slot.startAt}
                type="button"
                className={cx('st-booking__slot', selected === slot.startAt && 'is-selected')}
                aria-pressed={selected === slot.startAt}
                onClick={() => setSelected(slot.startAt)}
              >
                {formatTime(slot.startAt)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="st-booking__row">
        <div>
          <SparxLabel htmlFor="book-name">Name</SparxLabel>
          <SparxInput
            id="book-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <SparxLabel htmlFor="book-email">Email</SparxLabel>
          <SparxInput
            id="book-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <SparxLabel htmlFor="book-phone">Phone (optional)</SparxLabel>
        <SparxInput
          id="book-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div>
        <SparxLabel htmlFor="book-notes">Anything we should know? (optional)</SparxLabel>
        <SparxInput id="book-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error ? <SparxAlert color="danger">{error}</SparxAlert> : null}

      <SparxButton type="submit" color="primary" disabled={submitting || !selected}>
        {submitting ? 'Booking…' : selected ? `Book ${formatTime(selected)}` : 'Choose a time'}
      </SparxButton>
    </form>
  );
}
