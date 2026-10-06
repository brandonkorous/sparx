'use client';

// A booking as a fleet SERVICE RECORD (sparx persona issue 086): which trade
// account and vehicle the visit was for, and the parts from that account's orders
// that went into it.
//
// The /b2b page promises "parts from an order link to the service record: the full
// picture for the next visit". Staff tick the lines off the account's orders here,
// with how many of each, and every part keeps a link to its order. They can also
// put the visit on a trade account and set or change its vehicle, for a booking a
// contact made on the public site rather than from the portal.
//
// Shown only for a trade booking: one already on an account, or one whose person
// buys for an account. A haircut has no vehicle and no parts list.
//
// Color follows what each control belongs to: the account and vehicle are the
// trade account's (b2b), an order is commerce's, and saving the booking is the
// pane's own module.

import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Car, ExternalLink, PackageCheck, Save } from 'lucide-react';

import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useDirtySource } from '../../lib/workbench/dirty';
import { schedulingErrorMessage, type Booking } from './bookings-data';
import {
  useBookingServiceRecord,
  useSetBookingParts,
  useSetBookingVehicle,
  type BookingServiceRecord as RecordData,
} from './service-record-data';
import {
  partLine,
  partName,
  partsChanged,
  partsToTicks,
  ticksToPicks,
  type PartTicks,
} from './service-record-words';

const NO_VEHICLE = '';

export function BookingServiceRecord({ ctx, booking }: { ctx: SurfaceContext; booking: Booking }) {
  const [q, setQ] = useState('');
  const record = useBookingServiceRecord(booking.id, q.trim());
  const data = record.data;

  if (booking.bookingType !== 'appointment' || !data) return null;
  // Not a trade booking: no account on it, and its person buys for none.
  if (!data.company && data.accounts.length === 0) return null;

  return (
    <FormSection
      title="Vehicle and parts"
      description="Which of the account's vehicles this visit is for, and the parts from their orders that went into it."
    >
      <VehicleRow ctx={ctx} bookingId={booking.id} data={data} />
      {data.company ? (
        <PartsPicker
          // Re-seed the ticks when the saved parts change underneath.
          key={JSON.stringify(data.parts)}
          ctx={ctx}
          bookingId={booking.id}
          data={data}
          q={q}
          setQ={setQ}
        />
      ) : null}
    </FormSection>
  );
}

function VehicleRow({
  ctx,
  bookingId,
  data,
}: {
  ctx: SurfaceContext;
  bookingId: string;
  data: RecordData;
}) {
  const toast = useToast();
  const setVehicle = useSetBookingVehicle(bookingId);
  const savedCompany = data.company?.id ?? '';
  const savedVehicle = data.vehicle?.vehicleId ?? NO_VEHICLE;
  const [companyId, setCompanyId] = useState(savedCompany);
  const [vehicleId, setVehicleId] = useState(savedVehicle);

  // The account the visit is on, plus every account its person buys for.
  const accountChoices = useMemo(() => {
    const list = [...data.accounts];
    if (data.company && !list.some((a) => a.id === data.company!.id)) list.unshift(data.company);
    return list;
  }, [data.accounts, data.company]);

  const companyMoved = companyId !== savedCompany;
  const vehicleMoved = !companyMoved && vehicleId !== savedVehicle;
  // A vehicle no longer on the fleet stays named, so the record is not rewritten
  // by a fleet edit; it just is not offered for a new visit.
  const savedVehicleGone =
    data.vehicle !== null && !data.vehicles.some((v) => v.id === data.vehicle!.vehicleId);
  useDirtySource(
    companyMoved || vehicleMoved,
    'The vehicle on this booking is not saved. Close anyway?'
  );

  const save = () => {
    setVehicle.mutate(
      {
        companyId: companyId || null,
        // Moving to another account starts with no vehicle: the old account's
        // vehicles are not this one's.
        vehicleId: companyMoved ? null : vehicleId || null,
      },
      {
        onSuccess: () => {
          toast.add({
            title: companyMoved ? 'Visit moved to the account' : 'Vehicle saved',
            type: 'success',
          });
          if (companyMoved) setVehicleId(NO_VEHICLE);
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save the vehicle',
            description: schedulingErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-0 flex-1">
          <FieldLabel>Trade account</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                color="module-b2b"
                value={companyId}
                onChange={(event) => {
                  setCompanyId(event.target.value);
                }}
              >
                {!data.company ? <option value="">Not on an account</option> : null}
                {accountChoices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.companyName}
                  </option>
                ))}
              </NativeSelect>
            }
          />
        </Field>
        {data.company && !companyMoved ? (
          <Button
            size="sm"
            variant="outline"
            color="module-b2b"
            onClick={() => {
              ctx.open('b2b.account.detail', { id: data.company!.id }, { target: 'beside' });
            }}
          >
            <ExternalLink className="size-4" aria-hidden />
            Open account
          </Button>
        ) : null}
      </div>

      {!companyMoved && data.company ? (
        <Field>
          <FieldLabel>Vehicle</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                color="module-b2b"
                value={vehicleId}
                disabled={data.vehicles.length === 0 && !data.vehicle}
                onChange={(event) => {
                  setVehicleId(event.target.value);
                }}
              >
                <option value={NO_VEHICLE}>No vehicle</option>
                {savedVehicleGone ? (
                  <option value={data.vehicle!.vehicleId}>
                    {data.vehicle!.label} (no longer on the fleet)
                  </option>
                ) : null}
                {data.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </NativeSelect>
            }
          />
          {data.vehicles.length === 0 ? (
            <FieldDescription>
              This account has no vehicles yet. Add them on the account&rsquo;s fleet.
            </FieldDescription>
          ) : data.vehicle?.vin ? (
            <FieldDescription>VIN {data.vehicle.vin}</FieldDescription>
          ) : null}
        </Field>
      ) : null}

      {companyMoved && companyId ? (
        <Text className="text-sm">
          The visit moves to this account first. Then pick which of its vehicles it is for.
        </Text>
      ) : null}

      <div>
        <Button
          size="sm"
          color="module"
          disabled={!(companyMoved || vehicleMoved) || setVehicle.isPending}
          loading={setVehicle.isPending}
          onClick={save}
        >
          <Car className="size-4" aria-hidden />
          {companyMoved
            ? companyId
              ? 'Move to this account'
              : 'Take off the account'
            : 'Save vehicle'}
        </Button>
      </div>
    </div>
  );
}

function PartsPicker({
  ctx,
  bookingId,
  data,
  q,
  setQ,
}: {
  ctx: SurfaceContext;
  bookingId: string;
  data: RecordData;
  q: string;
  setQ: (q: string) => void;
}) {
  const toast = useToast();
  const setParts = useSetBookingParts(bookingId);
  const saved = useMemo(() => partsToTicks(data.parts), [data.parts]);
  const [ticks, setTicks] = useState<PartTicks>(saved);
  const changed = partsChanged(saved, ticks);
  useDirtySource(changed, 'The parts on this booking are not saved. Close anyway?');

  const openOrder = (orderId: string) => {
    ctx.open('commerce.order.detail', { id: orderId }, { target: 'beside' });
  };

  const save = () => {
    setParts.mutate(ticksToPicks(ticks), {
      onSuccess: () => {
        toast.add({ title: 'Parts saved', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not save the parts',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-base font-semibold">Parts on this visit</span>
        <Button
          size="sm"
          color="module"
          disabled={!changed || setParts.isPending}
          loading={setParts.isPending}
          onClick={save}
        >
          <Save className="size-4" aria-hidden />
          Save parts
        </Button>
      </div>

      {data.parts.length === 0 ? (
        <Text className="text-sm">
          No parts yet. Tick them from the account&rsquo;s orders below.
        </Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.parts.map((p, i) => (
            <li
              key={`${p.orderItemId ?? p.title}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 text-base">
                <PackageCheck className="size-4 shrink-0" aria-hidden />
                {partLine(p)}
              </span>
              {p.orderId && p.orderNumber ? (
                <Button
                  size="sm"
                  variant="ghost"
                  color="module-commerce"
                  onClick={() => {
                    openOrder(p.orderId!);
                  }}
                >
                  Order {p.orderNumber}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Field>
        <FieldLabel>Find an order</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module-commerce"
              type="search"
              value={q}
              placeholder="Order number"
              onChange={(event) => {
                setQ(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          The account&rsquo;s newest orders are listed. Search for an older one.
        </FieldDescription>
      </Field>

      {data.orders.length === 0 ? (
        <Text className="text-sm">
          {q.trim()
            ? 'No order on this account matches that number.'
            : 'This account has no orders yet.'}
        </Text>
      ) : (
        <div className="flex flex-col gap-3">
          {data.orders.map((order) => (
            <div
              key={order.id}
              className="border-base-300 rounded-box flex flex-col gap-2 border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-semibold">
                  Order {order.orderNumber}
                  <span className="font-normal">
                    {' '}
                    ·{' '}
                    {new Date(order.placedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  color="module-commerce"
                  onClick={() => {
                    openOrder(order.id);
                  }}
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Open order
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {order.items.map((line) => {
                  const count = ticks[line.id] ?? 0;
                  const on = count > 0;
                  return (
                    <li key={line.id} className="flex flex-wrap items-center gap-3">
                      <Checkbox
                        color="module"
                        size="sm"
                        checked={on}
                        aria-label={`Used ${line.name} on this visit`}
                        onChange={() => {
                          setTicks((prev) => ({ ...prev, [line.id]: on ? 0 : 1 }));
                        }}
                      />
                      <span className="min-w-0 flex-1 text-base">
                        {partName(line.name, line.sku)}
                      </span>
                      <span className="text-sm whitespace-nowrap">{line.quantity} ordered</span>
                      {on ? (
                        <Input
                          color="module"
                          type="number"
                          size="sm"
                          className="w-20"
                          min={1}
                          max={line.quantity}
                          aria-label={`How many ${line.name} went into this visit`}
                          value={count}
                          onChange={(event) => {
                            const n = Math.max(
                              1,
                              Math.min(line.quantity, Math.floor(Number(event.target.value) || 1))
                            );
                            setTicks((prev) => ({ ...prev, [line.id]: n }));
                          }}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
