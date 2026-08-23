'use client';

// Customer booking widget (docs/79 §13). Pick a date → see open times for the
// service → enter contact details → book. Runs entirely in the browser against
// the public scheduling surface via the /api/sparx proxy; the slot list is what
// the engine's no-overlap guarantee will accept, so a confirmed time is real.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

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
import {
  dayAfter,
  dayOf,
  formatStamp,
  formatTime,
  readsTheSame,
  startOfDay,
  today,
  zoneName,
} from './booking-clock';

/** "Cut and finish with Nia Okafor" — the service, and the person it is with when
 *  one was chosen. Naming them is what makes a customer's choice of stylist look
 *  like it took; without it the receipt is silent about the thing she picked. */
function bookedThing(confirmation: BookingConfirmation): string {
  return confirmation.staff
    ? `${confirmation.serviceName} with ${confirmation.staff}`
    : confirmation.serviceName;
}

export function BookingWidget({
  tenantSlug,
  service,
  onBooked,
}: {
  tenantSlug: string;
  service: PublicService;
  /**
   * Called once a booking actually exists, with its id.
   *
   * Only the booking-link page uses it, to say "that one came through /meet/…"
   * — the CRM meaning, recorded AFTER scheduling has done the real work rather
   * than instead of it. It deliberately fires from the same two places that set
   * the confirmation, deposit path included: a booking paid for is still a
   * booking, and a link whose counter only moved for the free services would be
   * a counter nobody could trust.
   */
  onBooked?: (bookingId: string) => void;
}) {
  const isReservation = service.bookingType === 'reservation';
  const tz = service.timezone ?? null;
  const isCustomerChoice = service.assignmentStrategy === 'customer_choice';
  // Today WHERE THE BUSINESS IS. A reader whose own date has already turned over
  // would otherwise open on tomorrow, or on a day the salon has not reached.
  const [date, setDate] = useState(() => today(tz));
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
  // Whether we've resolved the first bookable day yet. Until then the slot area shows
  // "Checking availability…" rather than an empty state, so a service that isn't open
  // TODAY never flashes "no open times" before we jump to the day that is.
  const [seededDate, setSeededDate] = useState(false);

  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true);
    setSelected(null);
    setError(null);
    try {
      const from = startOfDay(date, tz);
      const to = startOfDay(dayAfter(date), tz);
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
  }, [tenantSlug, service.id, date, partySize, isReservation, chosenResourceId, tz]);

  useEffect(() => {
    void fetchSlots();
  }, [fetchSlots]);

  // Open the picker on the FIRST bookable day, not a dead "today". A service whose
  // provider works only some weekdays — or any visitor arriving in the evening or on a
  // weekend — would otherwise land on an empty date and read the whole widget as
  // broken ("no open times"). Scan forward one week at a time (bounded by the service's
  // max-advance window) and jump the date to the first day with an open slot. Runs once;
  // the normal per-day fetch above takes over from there. If nothing's open in range we
  // leave the date on today and its (correct) empty state + waitlist offer shows.
  useEffect(() => {
    if (seededDate) return;
    let active = true;
    void (async () => {
      const start = today(tz);
      const maxDays = Math.min(service.maxAdvanceDays || 60, 120);
      for (let offset = 0; offset < maxDays; offset += 7) {
        const from = startOfDay(dayAfter(start, offset), tz);
        const to = startOfDay(dayAfter(start, offset + 7), tz);
        let found: PublicSlot[] = [];
        try {
          found = await loadSlots(
            tenantSlug,
            service.id,
            from.toISOString(),
            to.toISOString(),
            isReservation ? partySize : undefined,
            chosenResourceId ?? undefined
          );
        } catch {
          break; // network trouble — don't spin; the per-day fetch surfaces the error
        }
        if (!active) return;
        const first = found[0];
        if (first) {
          const iso = dayOf(first.startAt, tz);
          setDate((current) => (iso !== current ? iso : current));
          break;
        }
      }
      if (active) setSeededDate(true);
    })();
    return () => {
      active = false;
    };
  }, [
    seededDate,
    tenantSlug,
    service.id,
    service.maxAdvanceDays,
    isReservation,
    partySize,
    chosenResourceId,
    tz,
  ]);

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
        onBooked?.(result.id);
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
          onBooked?.(pendingDeposit.id);
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
            ? `We've received your request for ${bookedThing(confirmation)} on ${formatStamp(confirmation.startAt, tz)}. You'll get a confirmation once it's approved.`
            : `${bookedThing(confirmation)} is confirmed for ${formatStamp(confirmation.startAt, tz)}. A confirmation is on its way to ${email}.`}
        </p>
        {/* WHERE. A confirmation is read twice — once now, and once in the car by
            somebody who has never been here. `<address>` so a screen reader
            announces it as one. */}
        {confirmation.location ? (
          <address className="text-base-content not-italic">{confirmation.location}</address>
        ) : null}
        {confirmation.calendar ? <AddToCalendar links={confirmation.calendar} /> : null}
        {/* THE WAY BACK. This screen offered three ways to add the appointment to
            a calendar and none to change it, at the moment somebody is likeliest
            to notice they picked the wrong day (issue 153). The link is signed
            and needs no account — the same one the confirmation email carries. */}
        {confirmation.manageUrl ? (
          <p className="text-base-content text-sm">
            Need to change it?{' '}
            <Link className="link link-primary" href={confirmation.manageUrl}>
              Change or cancel this appointment
            </Link>
          </p>
        ) : null}
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
            min={today(tz)}
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
        {loadingSlots || !seededDate ? (
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
                {formatTime(slot.startAt, tz)}
              </button>
            ))}
          </div>
        )}
        {/* Only for a reader whose own clock disagrees — everybody else is local
            and does not need telling what time it is where they are. */}
        {tz && slots && slots.length > 0 && !readsTheSame(slots[0]!.startAt, tz) ? (
          <p className="text-base-content text-sm">
            All times shown are our local time ({zoneName(slots[0]!.startAt, tz)}).
          </p>
        ) : null}
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
        {submitting ? 'Booking…' : selected ? `Book ${formatTime(selected, tz)}` : 'Choose a time'}
      </Button>
    </form>
  );
}
