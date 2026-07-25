'use client';

// Customer booking widget (docs/79 §13). Pick a date → see open times for the
// service → enter contact details → book. Runs entirely in the browser against
// the public scheduling surface via the /api/sparx proxy; the slot list is what
// the engine's no-overlap guarantee will accept, so a confirmed time is real.

import { useCallback, useEffect, useState } from 'react';

import { Alert, Button, Input, Label } from '@wizeworks/silicaui-react';
import { cn } from '@/lib/cn';

import type { PublicService } from '../../lib/scheduling';
import {
  createPublicBooking,
  joinWaitlist,
  loadServiceResources,
  loadSlots,
  type BookableResource,
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
  const isCustomerChoice = service.assignmentStrategy === 'customer_choice';
  const [date, setDate] = useState(todayISODate());
  const [partySize, setPartySize] = useState(2);
  // The customer-chosen provider for a customer_choice service; null = "Any available".
  const [providers, setProviders] = useState<BookableResource[] | null>(null);
  const [chosenResourceId, setChosenResourceId] = useState<string | null>(null);
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
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);

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
        isReservation ? partySize : undefined,
        chosenResourceId ?? undefined
      );
      setSlots(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load availability.');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [tenantSlug, service.id, date, partySize, isReservation, chosenResourceId]);

  useEffect(() => {
    void fetchSlots();
  }, [fetchSlots]);

  // Load the pickable providers once, for a customer_choice service.
  useEffect(() => {
    if (!isCustomerChoice) return;
    let active = true;
    void loadServiceResources(tenantSlug, service.id)
      .then((r) => {
        if (active) setProviders(r);
      })
      .catch(() => {
        if (active) setProviders([]);
      });
    return () => {
      active = false;
    };
  }, [isCustomerChoice, tenantSlug, service.id]);

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
        ...(chosenResourceId ? { resourceId: chosenResourceId } : {}),
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

  async function joinWaitlistFlow() {
    if (!name.trim() || !email.trim()) {
      setError('Enter your name and email below, then join the waitlist.');
      return;
    }
    setJoiningWaitlist(true);
    setError(null);
    try {
      const from = new Date(`${date}T00:00`);
      const to = new Date(from);
      to.setDate(to.getDate() + 30);
      await joinWaitlist(tenantSlug, {
        serviceId: service.id,
        customer: {
          name: name.trim(),
          email: email.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        desiredFrom: from.toISOString(),
        desiredTo: to.toISOString(),
      });
      setWaitlistJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the waitlist.');
    } finally {
      setJoiningWaitlist(false);
    }
  }

  if (waitlistJoined) {
    return (
      <div className="card border-base-300 grid gap-2 border p-8 text-center" role="status">
        <h2 className="text-base-content text-2xl font-semibold">You&rsquo;re on the list</h2>
        <p className="text-base-content">
          We&rsquo;ll email {email} as soon as a spot opens for {service.name} in the coming weeks.
        </p>
      </div>
    );
  }

  if (pendingDeposit?.deposit) {
    return (
      <BookingDepositStep
        clientSecret={pendingDeposit.deposit.clientSecret}
        {...(pendingDeposit.deposit.publishableKey
          ? { publishableKey: pendingDeposit.deposit.publishableKey }
          : {})}
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
      <div className="card border-base-300 grid gap-2 border p-8 text-center" role="status">
        <h2 className="text-base-content text-2xl font-semibold">
          {confirmation.requiresApproval ? 'Request received' : "You're booked"}
        </h2>
        <p className="text-base-content">
          {confirmation.requiresApproval
            ? `We've received your request for ${confirmation.serviceName} on ${formatDateTime(confirmation.startAt)}. You'll get a confirmation once it's approved.`
            : `${confirmation.serviceName} is confirmed for ${formatDateTime(confirmation.startAt)}. A confirmation is on its way to ${email}.`}
        </p>
        {confirmation.calendar ? <AddToCalendar links={confirmation.calendar} /> : null}
      </div>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      {isCustomerChoice && providers && providers.length > 0 ? (
        <div className="grid gap-2">
          <Label>Choose your {service.providerLabel}</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                'rounded-field border-base-300 bg-base-100 text-base-content hover:border-primary border px-3.5 py-2 text-sm transition-colors',
                chosenResourceId === null && 'border-primary bg-primary text-primary-content'
              )}
              aria-pressed={chosenResourceId === null}
              onClick={() => setChosenResourceId(null)}
            >
              Any available
            </button>
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  'rounded-field border-base-300 bg-base-100 text-base-content hover:border-primary border px-3.5 py-2 text-sm transition-colors',
                  chosenResourceId === p.id && 'border-primary bg-primary text-primary-content'
                )}
                aria-pressed={chosenResourceId === p.id}
                onClick={() => setChosenResourceId(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[540px]:grid-cols-2">
        <div>
          <Label htmlFor="book-date">Date</Label>
          <Input
            id="book-date"
            type="date"
            min={todayISODate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {isReservation ? (
          <div>
            <Label htmlFor="book-party">Party size</Label>
            <Input
              id="book-party"
              type="number"
              min={1}
              value={partySize}
              onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label>Available times</Label>
        {loadingSlots ? (
          <p className="text-base-content">Checking availability…</p>
        ) : slots?.length === 0 ? (
          <div className="grid justify-items-start gap-2">
            <p className="text-base-content">
              No open times that day — try another date, or join the waitlist and we&rsquo;ll let
              you know the moment a spot opens.
            </p>
            <Button
              type="button"
              variant="soft"
              color="primary"
              disabled={joiningWaitlist}
              onClick={() => void joinWaitlistFlow()}
            >
              {joiningWaitlist ? 'Joining…' : 'Join the waitlist'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(slots ?? []).map((slot) => (
              <button
                key={slot.startAt}
                type="button"
                className={cn(
                  'rounded-field border-base-300 bg-base-100 text-base-content hover:border-primary border px-3.5 py-2 text-sm transition-colors',
                  selected === slot.startAt && 'border-primary bg-primary text-primary-content'
                )}
                aria-pressed={selected === slot.startAt}
                onClick={() => setSelected(slot.startAt)}
              >
                {formatTime(slot.startAt)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[540px]:grid-cols-2">
        <div>
          <Label htmlFor="book-name">Name</Label>
          <Input id="book-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="book-email">Email</Label>
          <Input
            id="book-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="book-phone">Phone (optional)</Label>
        <Input
          id="book-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="book-notes">Anything we should know? (optional)</Label>
        <Input id="book-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error ? <Alert color="danger">{error}</Alert> : null}

      <Button type="submit" color="primary" disabled={submitting || !selected}>
        {submitting ? 'Booking…' : selected ? `Book ${formatTime(selected)}` : 'Choose a time'}
      </Button>
    </form>
  );
}
