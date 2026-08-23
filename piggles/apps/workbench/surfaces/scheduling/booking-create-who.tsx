'use client';

// WHO A NEW BOOKING IS FOR — the customer, or the name of somebody who has no
// record, or how many of them there are.
//
// Its own file because the question is its own: everything else on the create
// form is about the appointment, and this is about the person. It also carries
// the walk-in path, which is the part that was missing — the section has always
// said "leave it blank for a booking with no account, a walk-in you are writing
// down" and offered nothing to write it in, so a walk-in was a booking nobody
// could ever name (issue 139).

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
} from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { CustomerPicker } from './bookings-customer-picker';
import type { CustomerLite } from './bookings-data';

export function BookingCreateWho({
  customer,
  setCustomer,
  guestName,
  setGuestName,
  partySize,
  setPartySize,
}: {
  customer: CustomerLite | null;
  setCustomer: (value: CustomerLite | null) => void;
  guestName: string;
  setGuestName: (value: string) => void;
  partySize: string;
  setPartySize: (value: string) => void;
}) {
  return (
    <FormSection
      title="Who it is for"
      description="Link the customer this is booked for, so it shows on their record and their reminders reach them. Leave it blank for a booking with no account — a walk-in you are writing down."
    >
      <CustomerPicker value={customer} onChange={setCustomer} />

      {/* Only when there is no account to link. Somebody who walks in off the
            street has a name and no record, and this is where it goes — the
            section's own description has always promised it. With a customer
            chosen the field disappears rather than sitting there inviting a
            second, competing name for the same person. */}
      {customer ? null : (
        <Field>
          <FieldLabel>Or just their name</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                className="max-w-sm"
                placeholder="Tomás from next door"
                value={guestName}
                onChange={(event) => {
                  setGuestName(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            For a walk-in with no account. It shows on the booking and in your diary, and it does
            not create a customer record.
          </FieldDescription>
        </Field>
      )}

      <Field>
        <FieldLabel>How many people (optional)</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              type="number"
              min={1}
              className="max-w-32"
              value={partySize}
              placeholder="1"
              onChange={(event) => {
                setPartySize(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          For a table or a group — how many are coming. Leave blank for one.
        </FieldDescription>
      </Field>
    </FormSection>
  );
}
