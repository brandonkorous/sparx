'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  Label,
  NativeSelect,
  Loading,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, toast, type SurfaceStepDef } from '@sparx/ui';

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
import { useDetailFooterNode } from '../../../_components/detail-header-slot';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../_components/detail-panel';

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
  // Overlay only: the drawer/modal host's own toolbar row, already rendered by
  // `detail-panel.tsx`'s `DetailHeader`. Handing it to `SurfaceFrame` merges the
  // form's own toolbar into THAT row instead of stacking a second one underneath
  // it — null until the host mounts.
  const overlayActionsTarget = useDetailFooterNode();
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
        <Card>
          <CardBody className="py-6">
            <p className="text-base-content/70 text-sm">
              No active services to book. Create a service first.
            </p>
          </CardBody>
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
        <Card>
          <CardBody className="py-6">
            <CardTitle>Service &amp; time</CardTitle>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Service</FieldLabel>
                  <NativeSelect
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
                </Field>
                <Field>
                  <FieldLabel>Date</FieldLabel>
                  <FieldControl
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>

              {isReservation ? (
                <Field className="max-w-[12rem]">
                  <FieldLabel>Party size</FieldLabel>
                  <FieldControl
                    type="number"
                    min={1}
                    value={partySize}
                    onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
                  />
                </Field>
              ) : null}

              <div>
                <Button type="button" variant="outline" onClick={loadSlots} loading={loading}>
                  Find available times
                </Button>
              </div>

              {loading ? (
                <div className="flex flex-row items-center gap-2">
                  <Loading size="sm" />
                  <p className="text-base-content/70 text-sm">Checking availability…</p>
                </div>
              ) : slots ? (
                slots.length === 0 ? (
                  <p className="text-base-content/70 text-sm">
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

              {repeat ? null : (
                <>
                  <Field>
                    <FieldLabel>Customer name</FieldLabel>
                    <FieldControl
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Optional — for walk-ins or phone bookings"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Notes</FieldLabel>
                    <FieldControl
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      render={<Textarea rows={2} />}
                    />
                  </Field>
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
            </div>
          </CardBody>
        </Card>
      </SurfaceStep>
    );
  }

  return (
    <ModuleProvider module="scheduling" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title="New booking"
        backLabel="Bookings"
        headerActions={
          presentation === 'page' ? (
            <ViewSwitcher typeId="booking" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        actionsTarget={presentation === 'overlay' ? overlayActionsTarget : undefined}
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        {body}
      </SurfaceFrame>
    </ModuleProvider>
  );
}
