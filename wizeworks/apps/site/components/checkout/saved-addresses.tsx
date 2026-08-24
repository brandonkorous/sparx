'use client';

// A signed-in shopper's address book, at checkout.
//
// The addresses were always there — the account area has listed and edited them
// for as long as it has existed, and its own note says the default one "is used
// to prefill checkout". It never was. So somebody who had already told this
// shop where they live typed it in again on every order, which is the half of
// issue 064 that shows up once delivery IS on offer.

import type { Address as BookAddress } from '@/lib/customer-client';
import type { Address } from '@/lib/checkout-client';

/** The address book's shape → the checkout's. They differ in one field: the
 *  book keys the person `recipientName`, checkout calls it `name`. */
export function toCheckoutAddress(a: BookAddress, fallbackName: string): Address {
  return {
    name: a.recipientName ?? fallbackName,
    line1: a.line1,
    line2: a.line2 ?? '',
    city: a.city,
    region: a.region ?? '',
    postalCode: a.postalCode ?? '',
    country: a.country,
    phone: a.phone ?? '',
  };
}

/** One line, the way an envelope reads. */
export function describeAddress(a: BookAddress): string {
  return [a.line1, a.line2, [a.city, a.region, a.postalCode].filter(Boolean).join(' ')]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(', ');
}

const ROW =
  'rounded-field border-base-300 has-[input:checked]:border-primary has-[input:checked]:bg-primary/[0.06] flex cursor-pointer items-start gap-3 border p-3';

export function SavedAddressChoices({
  addresses,
  selectedId,
  onSelect,
}: {
  addresses: BookAddress[];
  /** Null means "a different address" — the form below is showing. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="text-base-content mb-2 text-2xl font-semibold">
        Send it to one of your addresses
      </legend>
      {addresses.map((a) => (
        // The visible text is entirely the shopper's own data, so the accessible
        // name is spelled out here rather than assembled from it by a reader.
        <label key={a.id} className={ROW} aria-label={`Send it to ${describeAddress(a)}`}>
          <input
            type="radio"
            name="saved-address"
            className="radio mt-1"
            checked={selectedId === a.id}
            onChange={() => onSelect(a.id)}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">
              {a.label ?? a.recipientName ?? describeAddress(a)}
              {a.isDefault ? <span className="text-base-content"> · your usual one</span> : null}
            </span>
            <span className="text-base-content text-sm">{describeAddress(a)}</span>
          </span>
        </label>
      ))}
      <label className={ROW}>
        <input
          type="radio"
          name="saved-address"
          className="radio mt-1"
          checked={selectedId === null}
          onChange={() => onSelect(null)}
        />
        <span className="font-medium">Send it somewhere else</span>
      </label>
    </fieldset>
  );
}
