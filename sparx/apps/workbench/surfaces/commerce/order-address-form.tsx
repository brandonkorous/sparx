'use client';

// Saying where an order goes, when nobody said at the time.
//
// An order usually arrives with its address on it: a shopper typed one at
// checkout, or the till copied one down. Two doors do not — an order converted
// from an accepted quote (a quote is a price, and nobody asks a price where the
// goods are going) and an order typed in for a business with no address on
// file. Those land with "Not given" printed where the address should be, and
// until now that was the end of the road.
//
// IT STAYS A SNAPSHOT. This writes the order's OWN copy of the address, never
// the customer's address book, so the promise the section makes — that changing
// a customer's address later never rewrites where this one went — holds in both
// directions.
//
// IN THE PANE, NOT A MODAL. Real editing stays where the app's unsaved-work
// safety net can see it, the same rule the customer's address list follows.
//
// No "copy from the customer's saved addresses" shortcut: the address book is
// CRM's, and a tenant running Commerce without the CRM module would get a
// refusal where a helpful button was promised. Typing it is the one path that
// works for every tenant. [[feedback_a_promise_in_copy_is_a_contract]]

import { shownInPlace } from '@wizeworks/query';
import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { CountryField } from '../../components/country-field';
import { orderErrorMessage, useSetOrderAddresses, type Order, type OrderAddress } from './data';

interface AddressDraft {
  recipientName: string;
  company: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
}

const EMPTY: AddressDraft = {
  recipientName: '',
  company: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
};

function toDraft(address: OrderAddress | null): AddressDraft {
  if (!address) return { ...EMPTY };
  return {
    recipientName: address.recipientName ?? '',
    company: address.company ?? '',
    line1: address.line1 ?? '',
    line2: address.line2 ?? '',
    city: address.city ?? '',
    region: address.region ?? '',
    postalCode: address.postalCode ?? '',
    country: address.country ?? '',
    phone: address.phone ?? '',
  };
}

/** Present fields only — an empty box is an omitted key, not an empty string.
 *  The server reads an optional as absent-or-a-value, and an empty string would
 *  be stored and then drawn as a blank line inside the address. */
function toAddress(draft: AddressDraft): OrderAddress {
  const clean = (value: string) => (value.trim() === '' ? undefined : value.trim());
  const optional: OrderAddress = {
    recipientName: clean(draft.recipientName),
    company: clean(draft.company),
    line2: clean(draft.line2),
    region: clean(draft.region),
    postalCode: clean(draft.postalCode),
    phone: clean(draft.phone),
  };
  for (const key of Object.keys(optional) as (keyof OrderAddress)[]) {
    if (optional[key] === undefined) delete optional[key];
  }
  return {
    line1: draft.line1.trim(),
    city: draft.city.trim(),
    country: draft.country.trim().toUpperCase(),
    ...optional,
  };
}

/** Two addresses are the same when every field a person typed matches. */
function sameAddress(a: OrderAddress | null, b: OrderAddress | null): boolean {
  if (!a || !b) return false;
  return JSON.stringify(toDraft(a)) === JSON.stringify(toDraft(b));
}

function incomplete(draft: AddressDraft): boolean {
  return draft.line1.trim() === '' || draft.city.trim() === '' || draft.country.trim() === '';
}

function AddressFields({
  draft,
  showErrors,
  onChange,
  prefix,
}: {
  draft: AddressDraft;
  showErrors: boolean;
  onChange: (next: AddressDraft) => void;
  /** Distinguishes the two sets of boxes for anyone reading the screen aloud. */
  prefix: string;
}) {
  const set = <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => {
    onChange({ ...draft, [key]: value });
  };
  const line1Error = draft.line1.trim() === '' ? 'Enter the street address.' : null;
  const cityError = draft.city.trim() === '' ? 'Enter the town or city.' : null;
  const countryError = draft.country.trim() === '' ? 'Choose the country.' : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 @md:grid-cols-2">
        <Field>
          <FieldLabel>Who it is addressed to</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                aria-label={`${prefix} recipient`}
                value={draft.recipientName}
                placeholder="A person’s name"
                onChange={(event) => {
                  set('recipientName', event.target.value);
                }}
              />
            }
          />
        </Field>
        <Field>
          <FieldLabel>Business</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                aria-label={`${prefix} business`}
                value={draft.company}
                placeholder="Optional"
                onChange={(event) => {
                  set('company', event.target.value);
                }}
              />
            }
          />
        </Field>
      </div>

      <Field>
        <FieldLabel>Street address</FieldLabel>
        <FieldControl
          render={
            <Input
              color={line1Error && showErrors ? 'error' : 'module'}
              aria-label={`${prefix} street address`}
              value={draft.line1}
              placeholder="123 Main St"
              onChange={(event) => {
                set('line1', event.target.value);
              }}
            />
          }
        />
        {line1Error && showErrors ? <FieldStatus status="error">{line1Error}</FieldStatus> : null}
      </Field>

      <Field>
        <FieldLabel>Apartment, suite, unit</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              aria-label={`${prefix} apartment, suite, unit`}
              value={draft.line2}
              placeholder="Optional"
              onChange={(event) => {
                set('line2', event.target.value);
              }}
            />
          }
        />
      </Field>

      <div className="grid gap-3 @md:grid-cols-2">
        <Field>
          <FieldLabel>Town or city</FieldLabel>
          <FieldControl
            render={
              <Input
                color={cityError && showErrors ? 'error' : 'module'}
                aria-label={`${prefix} town or city`}
                value={draft.city}
                onChange={(event) => {
                  set('city', event.target.value);
                }}
              />
            }
          />
          {cityError && showErrors ? <FieldStatus status="error">{cityError}</FieldStatus> : null}
        </Field>
        <Field>
          <FieldLabel>State or region</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                aria-label={`${prefix} state or region`}
                value={draft.region}
                placeholder="Optional"
                onChange={(event) => {
                  set('region', event.target.value);
                }}
              />
            }
          />
        </Field>
      </div>

      <div className="grid gap-3 @md:grid-cols-2">
        <Field>
          <FieldLabel>Postal code</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                aria-label={`${prefix} postal code`}
                value={draft.postalCode}
                placeholder="Optional"
                onChange={(event) => {
                  set('postalCode', event.target.value);
                }}
              />
            }
          />
        </Field>
        <div className="flex flex-col gap-1">
          <CountryField
            required
            value={draft.country}
            onChange={(next) => {
              set('country', next);
            }}
          />
          {countryError && showErrors ? (
            <FieldStatus status="error">{countryError}</FieldStatus>
          ) : null}
        </div>
      </div>

      <Field>
        <FieldLabel>Phone</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              type="tel"
              aria-label={`${prefix} phone`}
              value={draft.phone}
              placeholder="Optional — the courier may need it"
              onChange={(event) => {
                set('phone', event.target.value);
              }}
            />
          }
        />
      </Field>
    </div>
  );
}

export function OrderAddressForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const save = useSetOrderAddresses(order.id);

  const [delivery, setDelivery] = useState<AddressDraft>(() => toDraft(order.shippingAddress));
  const [billing, setBilling] = useState<AddressDraft>(() => toDraft(order.billingAddress));
  // An order that has never had a billing address is almost always billed to
  // the place it is being posted to, so that is where the switch starts. One
  // that genuinely carries two different addresses opens with the switch off
  // and both sets of boxes showing what is on it.
  const [billSame, setBillSame] = useState(
    () => order.billingAddress === null || sameAddress(order.shippingAddress, order.billingAddress)
  );
  const [showErrors, setShowErrors] = useState(false);

  const blocked = incomplete(delivery) || (!billSame && incomplete(billing));
  const failure = save.isError
    ? orderErrorMessage(save.error, 'Could not save this address.')
    : null;

  const submit = () => {
    if (blocked) {
      setShowErrors(true);
      return;
    }
    const shippingAddress = toAddress(delivery);
    save.mutate(
      { shippingAddress, billingAddress: billSame ? shippingAddress : toAddress(billing) },
      { onSuccess: onDone, onError: shownInPlace }
    );
  };

  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-4 rounded-lg border p-3">
      <AddressFields
        draft={delivery}
        showErrors={showErrors}
        onChange={setDelivery}
        prefix="Delivery"
      />

      <Field>
        <FieldLabel>Bill it to the same place</FieldLabel>
        <FieldControl
          render={
            <Switch
              color="module"
              checked={billSame}
              onCheckedChange={(next: boolean) => {
                setBillSame(next);
              }}
            />
          }
        />
      </Field>

      {billSame ? null : (
        <div className="flex flex-col gap-3">
          <Text className="text-base font-semibold">Billing address</Text>
          <AddressFields
            draft={billing}
            showErrors={showErrors}
            onChange={setBilling}
            prefix="Billing"
          />
        </div>
      )}

      {failure ? <Text className="text-error text-base">{failure}</Text> : null}

      <div className="flex flex-wrap gap-2">
        <Button color="module" onClick={submit} loading={save.isPending}>
          Save the address
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
