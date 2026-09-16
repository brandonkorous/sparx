'use client';

// How the replacement is travelling — the same three questions in both places
// they are asked.
//
// They are asked twice because the answer arrives at two different moments. Some
// shops pick the replacement, pack it and post it before touching the console,
// and know the tracking number when they settle the swap. Most settle it while
// the customer is waiting and walk to the post office afterwards. One component
// so the two screens cannot drift into asking differently, and so a carrier
// added to the list appears on both.

import {
  Field,
  FieldControl,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';

import { CARRIERS } from './carriers';
import type { ShipmentForm } from './return-shipment';

export function ReplacementShipmentFields({
  value,
  onChange,
  trackingHint,
}: {
  value: ShipmentForm;
  onChange: (next: ShipmentForm) => void;
  /** What the tracking box says under it. The swap modal explains that leaving
   *  it empty is fine; the after-the-fact form does not, because there it is the
   *  entire point. */
  trackingHint?: string;
}) {
  const set = (patch: Partial<ShipmentForm>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <>
      <Field>
        <FieldLabel>Who is carrying it</FieldLabel>
        <NativeSelect
          color="module"
          value={value.carrier}
          aria-label="Who is carrying the replacement"
          onChange={(event) => {
            set({ carrier: event.target.value });
          }}
        >
          <option value="">Not sure yet</option>
          {CARRIERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {value.carrier === 'other' ? (
        <Field>
          <FieldLabel>Who, then</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={value.carrierOther}
                placeholder="Larimer Courier"
                aria-label="Name of the carrier"
                onChange={(event) => {
                  set({ carrierOther: event.target.value });
                }}
              />
            }
          />
        </Field>
      ) : null}

      <Field>
        <FieldLabel>Tracking number</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={value.trackingNumber}
              placeholder="9400 1000 0000 0000 0000 00"
              aria-label="Tracking number for the replacement"
              onChange={(event) => {
                set({ trackingNumber: event.target.value });
              }}
            />
          }
        />
        {trackingHint ? <Text className="text-sm">{trackingHint}</Text> : null}
      </Field>

      <Field>
        <FieldLabel>Link to follow it (optional)</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              type="url"
              value={value.trackingUrl}
              placeholder="https://tools.usps.com/go/TrackConfirmAction?tLabels=…"
              aria-label="Link the customer can follow the replacement on"
              onChange={(event) => {
                set({ trackingUrl: event.target.value });
              }}
            />
          }
        />
      </Field>
    </>
  );
}
