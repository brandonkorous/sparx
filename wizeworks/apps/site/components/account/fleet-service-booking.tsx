'use client';

// Book service for one of the account's vehicles, from the B2B portal (sparx
// persona issue 086). The /b2b page promises a fleet account "books service from
// the same portal: service types, durations, and capacity, tied to the account,
// with confirmations and reminders".
//
// Pick the vehicle, the service (only what the business offers, with how long it
// takes and what it costs), a time, and add a note. The times are the business's
// real openings from the same availability lookup the site's booking widget uses,
// in the business's own clock, and the server re-checks the time before it books.
// The booking is the signed-in contact's, so their confirmation and reminders come
// to them by email, and it is filed under the account and the vehicle.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Label, NativeSelect, Textarea } from '@wizeworks/silicaui-react';

import { AddToCalendar } from '@/components/booking/add-to-calendar';
import { BookingDepositStep } from '@/components/booking/booking-deposit-step';
import {
  bookButtonLabel,
  dayAfter,
  dayOf,
  formatStamp,
  formatTime,
  isBookableDay,
  readsTheSame,
  startOfDay,
  today,
  zoneName,
} from '@/components/booking/booking-clock';
import { useCustomer } from '@/components/customer-provider';
import {
  bookAccountService,
  type FleetServiceType,
  type FleetServiceVehicle,
  type ServiceBookingConfirmation,
} from '@/lib/fleet-service-client';
import { loadSlots, type PublicSlot } from '@/lib/scheduling-client';
import { serviceTypeSummary } from '@/lib/service-record-words';

export function FleetServiceBooking({
  accountId,
  services,
  vehicles,
  initialVehicleId,
  onBooked,
}: {
  accountId: string;
  services: FleetServiceType[];
  vehicles: FleetServiceVehicle[];
  initialVehicleId: string | null;
  /** Called once the booking exists, so the history below can show it. */
  onBooked: () => void;
}) {
  const { tenantSlug, propertySlug, customer } = useCustomer();
  const [vehicleId, setVehicleId] = useState(() =>
    initialVehicleId && vehicles.some((v) => v.id === initialVehicleId)
      ? initialVehicleId
      : (vehicles[0]?.id ?? '')
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const tz = service?.timezone ?? null;
  const [date, setDate] = useState(() => today(tz));
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<ServiceBookingConfirmation | null>(null);
  const [confirmation, setConfirmation] = useState<ServiceBookingConfirmation | null>(null);

  // Open on the first day the service has an opening, not on a closed "today": a
  // shop that is shut at the weekend would otherwise greet a Saturday visitor
  // with "no openings" and read as broken. Scans a week at a time, bounded by
  // how far ahead the service takes bookings.
  useEffect(() => {
    if (!service) return;
    let active = true;
    void (async () => {
      const start = today(service.timezone);
      const maxDays = Math.min(service.maxAdvanceDays || 60, 120);
      for (let offset = 0; offset < maxDays; offset += 7) {
        let found: PublicSlot[] = [];
        try {
          found = await loadSlots(
            tenantSlug,
            service.id,
            startOfDay(dayAfter(start, offset), service.timezone).toISOString(),
            startOfDay(dayAfter(start, offset + 7), service.timezone).toISOString()
          );
        } catch {
          break;
        }
        if (!active) return;
        const first = found[0];
        if (first) {
          setDate(dayOf(first.startAt, service.timezone));
          return;
        }
      }
      if (active) setDate(start);
    })();
    return () => {
      active = false;
    };
  }, [tenantSlug, service]);

  useEffect(() => {
    if (!service || !isBookableDay(date, tz)) {
      setSlots(null);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setSelected(null);
    setError(null);
    loadSlots(
      tenantSlug,
      service.id,
      startOfDay(date, tz).toISOString(),
      startOfDay(dayAfter(date), tz).toISOString()
    )
      .then((found) => active && setSlots(found))
      .catch((err: unknown) => {
        if (!active) return;
        setSlots([]);
        setError(err instanceof Error ? err.message : 'Openings could not be loaded just now.');
      })
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [tenantSlug, service, date, tz]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId || !service || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await bookAccountService(
        tenantSlug,
        accountId,
        {
          vehicleId,
          serviceId: service.id,
          startAt: selected,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        propertySlug
      );
      onBooked();
      if (result.deposit?.clientSecret) setPendingDeposit(result);
      else setConfirmation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The booking did not go through.');
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setConfirmation(null);
    setSelected(null);
    setNotes('');
  }

  if (vehicles.length === 0) {
    return (
      <Alert color="info">
        Add your vehicles on the{' '}
        <Link href={`/account/b2b/${encodeURIComponent(accountId)}/fleet`} className="link">
          Fleet page
        </Link>{' '}
        first, then book service for any of them here.
      </Alert>
    );
  }

  if (services.length === 0) {
    return (
      <Alert color="info">
        There are no services to book online right now. Call or email the shop to set one up.
      </Alert>
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
    const when = formatStamp(confirmation.startAt, confirmation.timezone);
    const thing = `${confirmation.serviceName} for ${confirmation.vehicle}`;
    const to = customer?.email ? ` to ${customer.email}` : '';
    return (
      <div className="card border-base-300 flex flex-col gap-3 border p-6" role="status">
        <h2 className="text-base-content text-2xl font-semibold">
          {confirmation.requiresApproval ? 'Request sent' : 'Service booked'}
        </h2>
        <p className="text-base-content">
          {confirmation.requiresApproval
            ? `You asked for ${thing} on ${when}. The shop confirms it, and you get an email${to} when they do.`
            : `${thing} is booked for ${when}. A confirmation email is on its way${to}.`}
        </p>
        {confirmation.location ? (
          <address className="text-base-content not-italic">{confirmation.location}</address>
        ) : null}
        {confirmation.calendar ? <AddToCalendar links={confirmation.calendar} /> : null}
        <div className="flex flex-wrap gap-3">
          {confirmation.manageUrl ? (
            <Button
              render={<Link href={confirmation.manageUrl} />}
              color="primary"
              variant="outline"
            >
              Change or cancel
            </Button>
          ) : null}
          <Button type="button" color="primary" onClick={startAnother}>
            Book another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="card border-base-300 flex flex-col gap-5 border p-4" onSubmit={submit}>
      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="service-vehicle">Vehicle</Label>
          <NativeSelect
            id="service-vehicle"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.currentTarget.value)}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="service-type">Service</Label>
          <NativeSelect
            id="service-type"
            value={serviceId}
            onChange={(e) => setServiceId(e.currentTarget.value)}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({serviceTypeSummary(s)})
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {service?.description ? <p className="text-base-content">{service.description}</p> : null}

      <div className="flex flex-col gap-1 min-[640px]:max-w-xs">
        <Label htmlFor="service-date">Day</Label>
        <Input
          id="service-date"
          type="date"
          min={today(tz)}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Open times</Label>
        {loadingSlots ? (
          <p className="text-base-content">Checking the shop&rsquo;s openings…</p>
        ) : slots === null ? (
          <p className="text-base-content">Choose a day to see the open times.</p>
        ) : slots.length === 0 ? (
          <p className="text-base-content">No openings that day. Try another day.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <Button
                key={slot.startAt}
                type="button"
                size="sm"
                color="primary"
                variant={selected === slot.startAt ? 'solid' : 'outline'}
                aria-pressed={selected === slot.startAt}
                onClick={() => setSelected(slot.startAt)}
              >
                {formatTime(slot.startAt, tz)}
              </Button>
            ))}
          </div>
        )}
        {tz && slots && slots.length > 0 && !readsTheSame(slots[0]!.startAt, tz) ? (
          <p className="text-base-content text-sm">
            Times are the shop&rsquo;s local time ({zoneName(slots[0]!.startAt, tz)}).
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="service-notes">Anything the shop should know? (optional)</Label>
        <Textarea
          id="service-notes"
          rows={3}
          maxLength={2000}
          value={notes}
          placeholder="It pulls to the left when braking."
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <div>
        <Button type="submit" color="primary" disabled={submitting || !selected || !vehicleId}>
          {submitting
            ? 'Booking…'
            : selected
              ? bookButtonLabel(selected, tz)
              : 'Choose a time to book'}
        </Button>
      </div>
    </form>
  );
}
