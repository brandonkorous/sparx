'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Grid,
  Input,
  Label,
  NativeSelect,
  Spinner,
  Stack,
  Textarea,
  toast,
} from '@sparx/ui';

import type { AvailabilitySlot, SchedulingService } from '../../_lib/types';
import { duration, formatTime, money } from '../../_lib/format';
import { createBookingAction, loadSlotsAction } from '../../_lib/actions';

interface Props {
  services: SchedulingService[];
  onSuccess: () => void;
  onCancel: () => void;
}

function todayISODate(): string {
  // Local YYYY-MM-DD for the date input's default.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function BookingForm({ services, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const bookable = services.filter((s) => s.isActive);
  const [serviceId, setServiceId] = useState(bookable[0]?.id ?? '');
  const [date, setDate] = useState(todayISODate());
  const [partySize, setPartySize] = useState(2);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const service = bookable.find((s) => s.id === serviceId);
  const isReservation = service?.bookingType === 'reservation';

  async function loadSlots() {
    if (!serviceId) {
      toast.error('Pick a service');
      return;
    }
    setLoading(true);
    setSlots(null);
    setSelected(null);
    const from = new Date(`${date}T00:00`).toISOString();
    const to = new Date(`${date}T00:00`);
    to.setDate(to.getDate() + 1);
    const result = await loadSlotsAction({
      serviceId,
      from,
      to: to.toISOString(),
      ...(isReservation ? { partySize } : {}),
    });
    setLoading(false);
    if (result.ok) {
      setSlots(result.data);
    } else {
      toast.error(result.error);
    }
  }

  async function create() {
    if (!selected) {
      toast.error('Pick a time');
      return;
    }
    setSaving(true);
    const attendees = customerName.trim()
      ? [{ guestName: customerName.trim(), partySize: isReservation ? partySize : 1 }]
      : [];
    const result = await createBookingAction({
      serviceId,
      startAt: selected,
      source: 'dashboard',
      ...(isReservation ? { partySize } : {}),
      ...(attendees.length ? { attendees } : {}),
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      toast.success('Booking created');
      onSuccess();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  if (bookable.length === 0) {
    return (
      <Stack gap={3} className="px-1 py-4">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No active services to book. Create a service first.
        </p>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Close
          </Button>
        </div>
      </Stack>
    );
  }

  return (
    <Stack gap={4} className="px-1 py-2">
      <Grid cols={2} gap={3}>
        <div>
          <Label htmlFor="bk-service">Service</Label>
          <NativeSelect
            id="bk-service"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setSlots(null);
              setSelected(null);
            }}
          >
            {bookable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {duration(s.durationMinutes)}
                {s.priceCents > 0 ? ` · ${money(s.priceCents, s.currency)}` : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="bk-date">Date</Label>
          <Input id="bk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </Grid>

      {isReservation ? (
        <div className="max-w-[12rem]">
          <Label htmlFor="bk-party">Party size</Label>
          <Input
            id="bk-party"
            type="number"
            min={1}
            value={partySize}
            onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      ) : null}

      <div>
        <Button type="button" variant="outline" onClick={loadSlots} loading={loading}>
          Find available times
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Spinner size="sm" /> Checking availability…
        </div>
      ) : slots ? (
        slots.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No open times that day. Try another date or adjust the resource&apos;s hours.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <Button
                key={slot.startAt}
                type="button"
                size="sm"
                color="module"
                variant={selected === slot.startAt ? 'solid' : 'outline'}
                onClick={() => setSelected(slot.startAt)}
              >
                {formatTime(slot.startAt)}
              </Button>
            ))}
          </div>
        )
      ) : null}

      <div>
        <Label htmlFor="bk-customer">Customer name</Label>
        <Input
          id="bk-customer"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Optional — for walk-ins or phone bookings"
        />
      </div>

      <div>
        <Label htmlFor="bk-notes">Notes</Label>
        <Textarea id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button color="module" loading={saving} disabled={!selected} onClick={create}>
          Create booking
        </Button>
      </div>
    </Stack>
  );
}
