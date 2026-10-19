'use client';

// Sending a box packed at the bench (sparx persona issue 357).
//
// The bench seals a box as a delivery that has not left. Until this, the order
// showed it as "Being packed" with no way to send it, so the box stayed packed
// for good and the form beneath it sent everything else instead. Here the box
// itself is sent: who took it, and its tracking number if there is one. The
// customer is told when this is pressed, not when the box was sealed.

import { useState } from 'react';
import { Button, Input, NativeSelect, Text, useToast } from '@wizeworks/silicaui-react';
import { CARRIERS, carrierChosen } from './carriers';
import { orderErrorMessage, useSendPackedBox } from './data';

export function SendPackedBox({
  orderId,
  fulfillmentId,
  chosenDelivery,
}: {
  orderId: string;
  fulfillmentId: string;
  /** The delivery the shopper chose, so the carrier starts on it (issue 340). */
  chosenDelivery: string | null;
}) {
  const send = useSendPackedBox(orderId);
  const toast = useToast();
  const [carrier, setCarrier] = useState<string>(() => carrierChosen(chosenDelivery));
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const unnamed = carrier === 'other' && courier.trim() === '';

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (unnamed) return;
        send.mutate(
          { fulfillmentId, carrier, courier, trackingNumber: tracking },
          {
            onSuccess: () => {
              toast.add({
                title: 'Box marked as sent',
                description: tracking.trim()
                  ? 'The customer has the tracking number and can follow it from here.'
                  : 'The customer has been told it is on its way. Add a tracking number later if you get one.',
                type: 'success',
              });
            },
            onError: (error) => {
              toast.add({
                title: 'Could not mark the box sent',
                description: orderErrorMessage(
                  error,
                  'Nothing changed on this order. Try again in a moment.'
                ),
                type: 'error',
              });
            },
          }
        );
      }}
    >
      <Text className="w-full text-sm">Packed and waiting. Say who took it to send it.</Text>
      <label className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">Who took it</span>
        <NativeSelect
          value={carrier}
          onChange={(event) => {
            setCarrier(event.target.value);
          }}
        >
          {CARRIERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </label>
      {carrier === 'other' ? (
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
          <span className="text-base font-medium">Courier’s name</span>
          <Input
            value={courier}
            placeholder="Estes, a local courier…"
            onChange={(event) => {
              setCourier(event.target.value);
            }}
          />
        </label>
      ) : null}
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">Tracking number (optional)</span>
        <Input
          value={tracking}
          onChange={(event) => {
            setTracking(event.target.value);
          }}
        />
      </label>
      <Button
        type="submit"
        color="primary"
        loading={send.isPending}
        disabled={unnamed}
        title={unnamed ? 'Say which courier took it' : undefined}
      >
        Mark this box as sent
      </Button>
    </form>
  );
}
