'use client';

// Writing down that the goods went: one button for a collection, carrier and
// tracking for a parcel. Only what may leave NOW is sent (order-ship-gate.ts);
// what must wait says why, in the server's words.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { orderErrorMessage, useRecordFulfillment, type DeliveryPlan, type Order } from './data';
import { CARRIERS, serviceFor } from './carriers';
import { whatCanShipNow, type ShipNow } from './order-ship-gate';

interface HandoverForm {
  carrier: string;
  /** The courier's name when "Another courier" is chosen (sparx persona issue 219). */
  courier: string;
  tracking: string;
  note: string;
  setCarrier: (next: string) => void;
  setCourier: (next: string) => void;
  setTracking: (next: string) => void;
  setNote: (next: string) => void;
}

function useHandoverForm(): HandoverForm {
  const [carrier, setCarrier] = useState<string>('usps');
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  return { carrier, courier, tracking, note, setCarrier, setCourier, setTracking, setNote };
}

/** "Another courier" with no name: the customer would read "Another courier". */
function unnamedCourier(plan: DeliveryPlan, form: HandoverForm): boolean {
  return !plan.collected && form.carrier === 'other' && form.courier.trim() === '';
}

/** The toast says which happened: a tracking number to follow, or none yet. */
function sentWords(plan: DeliveryPlan, tracking: string) {
  if (plan.collected)
    return { title: 'Marked as collected', description: 'This order is finished.' };
  return {
    title: 'Marked as sent',
    description: tracking.trim()
      ? 'The customer has the tracking number and can follow it from here.'
      : 'The customer has been told it is on its way. Add a tracking number later if you get one.',
  };
}

function useHandoverSubmit(order: Order, plan: DeliveryPlan, shipNow: ShipNow, form: HandoverForm) {
  const record = useRecordFulfillment(order.id);
  const toast = useToast();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (shipNow.lines.length === 0 || unnamedCourier(plan, form)) return;
    record.mutate(
      {
        status: plan.collected ? 'delivered' : 'shipped',
        lines: shipNow.lines,
        carrier: plan.collected ? 'pickup' : form.carrier,
        ...(plan.collected ? {} : { carrierOther: form.courier }),
        ...(plan.collected
          ? plan.description
            ? { service: plan.description }
            : {}
          : serviceFor(plan.description, form.carrier)
            ? { service: serviceFor(plan.description, form.carrier) }
            : {}),
        ...(plan.collected ? {} : { trackingNumber: form.tracking }),
        notes: form.note,
      },
      {
        onSuccess: () => {
          toast.add({ ...sentWords(plan, form.tracking), type: 'success' });
          form.setTracking('');
          form.setNote('');
        },
        onError: (error) => {
          toast.add({
            title: plan.collected ? 'Could not mark it collected' : 'Could not mark it sent',
            description: orderErrorMessage(
              error,
              'Nothing changed on this order. Try again in a moment.'
            ),
            type: 'error',
          });
        },
      }
    );
  };
  return { submit, busy: record.isPending };
}

function PostedFields({ form }: { form: HandoverForm }) {
  return (
    <>
      <label className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">Who took it</span>
        <NativeSelect
          value={form.carrier}
          onChange={(event) => {
            form.setCarrier(event.target.value);
          }}
        >
          {CARRIERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </label>
      {form.carrier === 'other' ? (
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
          <span className="text-base font-medium">Courier’s name</span>
          <Input
            value={form.courier}
            placeholder="Estes, a local courier…"
            onChange={(event) => {
              form.setCourier(event.target.value);
            }}
          />
        </label>
      ) : null}
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">Tracking number (optional)</span>
        <Input
          value={form.tracking}
          onChange={(event) => {
            form.setTracking(event.target.value);
          }}
        />
      </label>
    </>
  );
}

/** Nothing may go yet: a held B2B order, or every part waiting for its old part. */
function NotReady({ plan, why }: { plan: DeliveryPlan; why: string }) {
  return (
    <Alert color="warning" className="mt-4">
      <AlertContent>
        <AlertTitle>
          {plan.collected ? 'Not ready to hand over yet' : 'Not ready to send yet'}
        </AlertTitle>
        <AlertDescription>{why}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export function RecordHandover({ order, plan }: { order: Order; plan: DeliveryPlan }) {
  const shipNow = whatCanShipNow(order);
  const form = useHandoverForm();
  const { submit, busy } = useHandoverSubmit(order, plan, shipNow, form);
  if (shipNow.refusal !== null) return <NotReady plan={plan} why={shipNow.refusal} />;

  return (
    <form
      onSubmit={submit}
      className="border-base-300 mt-4 flex flex-wrap items-end gap-3 border-t pt-4"
    >
      {shipNow.held.map((why) => (
        <Text key={why} className="w-full">
          {why}
        </Text>
      ))}
      {plan.collected ? null : <PostedFields form={form} />}
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">Anything to note (optional)</span>
        <Input
          value={form.note}
          placeholder={plan.collected ? 'Who picked it up…' : 'Left with a neighbor…'}
          onChange={(event) => {
            form.setNote(event.target.value);
          }}
        />
      </label>
      <Button
        type="submit"
        color="primary"
        loading={busy}
        disabled={unnamedCourier(plan, form)}
        title={unnamedCourier(plan, form) ? 'Say which courier took it' : undefined}
      >
        {plan.collected ? 'They collected it' : 'Mark it as sent'}
      </Button>
    </form>
  );
}
