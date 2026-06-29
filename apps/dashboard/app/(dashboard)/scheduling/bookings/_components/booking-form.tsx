'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Grid,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Spinner,
  Stack,
  SurfaceFrame,
  SurfaceStep,
  Switch,
  Text,
  Textarea,
  toast,
  type SurfaceStepDef,
} from '@sparx/ui';

import type { AvailabilitySlot, SchedulingService } from '../../_lib/types';
import { duration, formatTime, money } from '../../_lib/format';
import {
  createBookingAction,
  createBookingSeriesAction,
  loadSlotsAction,
} from '../../_lib/actions';
import {
  buildRrule,
  defaultRecurrence,
  RecurrenceFields,
  type RecurrenceValue,
} from './recurrence-fields';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// Booking create on the standard form surface (docs/86 F layout). Create-only —
// bookings have no edit form (status changes go through booking-actions), so this
// drives just page / overlay. The slot picker + optional recurrence live inside
// one step; the primary action stays disabled until a time is chosen.

type Presentation = 'page' | 'overlay';

interface BookingFormProps {
  presentation: Presentation;
  services: SchedulingService[];
}

function todayISODate(): string {
  // Local YYYY-MM-DD for the date input's default.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STEPS: SurfaceStepDef[] = [{ key: 'booking', label: 'Booking' }];

export function BookingForm({ presentation, services }: BookingFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [repeat, setRepeat] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(defaultRecurrence);

  const service = bookable.find((s) => s.id === serviceId);
  const isReservation = service?.bookingType === 'reservation';

  // Guard a started booking — a chosen time or entered guest detail is work worth
  // protecting; idly changing the service/date is not.
  const dirty = selected !== null || customerName.trim() !== '' || notes.trim() !== '' || repeat;
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'booking' });

  const close = useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
      return;
    }
    router.push('/scheduling/bookings');
  }, [presentation, pathname, searchParams, router]);

  const cancel = useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

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
    if (repeat) {
      await createSeries();
      return;
    }
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
      close();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function createSeries() {
    const result = await createBookingSeriesAction({
      serviceId,
      startAt: selected!,
      rrule: buildRrule(recurrence),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const made = result.data.created.length;
    const skipped = result.data.skipped.length;
    toast.success(
      `Created ${made} booking${made === 1 ? '' : 's'}${
        skipped > 0 ? ` · ${skipped} skipped (time taken)` : ''
      }`
    );
    close();
    router.refresh();
  }

  let body: React.ReactNode;
  if (bookable.length === 0) {
    body = (
      <SurfaceStep
        header={{
          title: 'New booking',
          supporting:
            'Pick a service and a time — only open slots that respect availability are shown.',
        }}
      >
        <Card variant="module">
          <CardContent className="py-6">
            <Text size="sm" variant="muted">
              No active services to book. Create a service first.
            </Text>
          </CardContent>
        </Card>
      </SurfaceStep>
    );
  } else {
    body = (
      <SurfaceStep
        header={{
          title: 'New booking',
          supporting:
            'Pick a service and a time — only open slots that respect availability and buffers are shown.',
        }}
        actions={{
          onNext: () => void create(),
          nextLabel: repeat ? 'Create series' : 'Create booking',
          nextLoading: saving,
          nextDisabled: saving || !selected,
        }}
      >
        <Card variant="module">
          <CardHeader>
            <CardTitle>Service &amp; time</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <Stack gap={4}>
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
                  <Input
                    id="bk-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
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
                <Stack direction="row" align="center" gap={2}>
                  <Spinner size="sm" />
                  <Text size="sm" variant="muted">
                    Checking availability…
                  </Text>
                </Stack>
              ) : slots ? (
                slots.length === 0 ? (
                  <Text size="sm" variant="muted">
                    No open times that day. Try another date or adjust the resource&apos;s hours.
                  </Text>
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

              {repeat ? null : (
                <>
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
                    <Textarea
                      id="bk-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <Switch
                  id="bk-repeat"
                  checked={repeat}
                  onCheckedChange={setRepeat}
                  color="module"
                />
                <Label htmlFor="bk-repeat" className="cursor-pointer">
                  Repeat this booking
                </Label>
              </div>

              {repeat ? <RecurrenceFields value={recurrence} onChange={setRecurrence} /> : null}
            </Stack>
          </CardContent>
        </Card>
      </SurfaceStep>
    );
  }

  return (
    <ModuleProvider module="scheduling" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title="New booking"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        {body}
      </SurfaceFrame>
    </ModuleProvider>
  );
}
