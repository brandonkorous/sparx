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

/**
 * Who this parcel is addressed to, for the line above the street.
 *
 * NEVER the address itself. The old fallback chain ended in `describeAddress`,
 * so an address saved with no nickname and no recipient printed the same street
 * twice, one line above the other — and it was the DEFAULT one that did it,
 * because that is the one checkout creates from a guest order. The name was in
 * the component's hand the whole time: `toCheckoutAddress` two functions up
 * already falls back to the contact name for exactly this.
 */
function recipientOf(a: BookAddress, fallbackName: string): string | null {
  const named = a.label ?? a.recipientName ?? fallbackName;
  return named.trim() === '' ? null : named;
}

export function SavedAddressChoices({
  addresses,
  selectedId,
  onSelect,
  fallbackName,
}: {
  addresses: BookAddress[];
  /** Null means "a different address" — the form below is showing. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Who is buying, for an address that was saved without a recipient. */
  fallbackName: string;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="text-base-content mb-2 text-2xl font-semibold">
        Send it to one of your addresses
      </legend>
      {addresses.map((a) => {
        const who = recipientOf(a, fallbackName);
        // No aria-label. It used to read "Send it to <street>", which REPLACED
        // the contents — so "your usual one", the single fact that tells these
        // rows apart, was on the screen and in nobody's ears. The legend above
        // already says what the group is for, so the contents are the name.
        return (
          <label key={a.id} className={ROW}>
            <input
              type="radio"
              name="saved-address"
              className="radio mt-1"
              checked={selectedId === a.id}
              onChange={() => onSelect(a.id)}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              {who !== null ? (
                <span className="font-medium">
                  {who}
                  {a.isDefault ? (
                    <span className="text-base-content"> · your usual one</span>
                  ) : null}
                </span>
              ) : null}
              <span className={who !== null ? 'text-base-content text-sm' : 'font-medium'}>
                {describeAddress(a)}
                {who === null && a.isDefault ? (
                  <span className="text-base-content"> · your usual one</span>
                ) : null}
              </span>
            </span>
          </label>
        );
      })}
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
