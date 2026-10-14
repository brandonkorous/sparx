'use client';

// WHAT THIS CUSTOMER PAYS (issue 737). Moved out of sale-detail.tsx (sparx
// persona issue 230); the rule is unchanged.
//
// The till used to fill every line with the catalog's list price and post it
// through, so a shop with a signed agreement was quoted full retail at the
// counter it sells from — while its own website charged the agreed figure.
//
// Asked again whenever the customer, the site or a quantity changes, because
// all three change the answer: an agreement belongs to one business, a price
// list to one site, and a bulk break to a number of units. A price she has
// typed is never overwritten; the line says what the agreed one was instead.

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import type { CustomerSummary } from '../invoicing/customer-picker';
import { useAgreedPrices, type AgreedPrice, type SaleLine } from './sale-data';

/** The basket as a string, so an effect fires on a real change rather than on
 *  every render's new array. Hand-typed lines are absent: there is nothing to
 *  ask the pricing engine about them. */
function basketKey(
  customerId: string | null,
  propertyId: string | null,
  lines: SaleLine[]
): string {
  const items = lines
    .filter((line) => line.variantId !== null)
    .map((line) => `${line.variantId}:${line.quantity}`)
    .join(',');
  return `${customerId ?? ''}|${propertyId ?? ''}|${items}`;
}

/** Nobody named, so the catalog price is the whole of what is known — and an
 *  untouched line goes BACK to it. Leaving the last customer's figure on screen
 *  after they were taken off is how a wholesale price gets taken over the
 *  counter from somebody who was never entitled to it. */
function backToListPrices(current: SaleLine[]): SaleLine[] {
  if (!current.some((line) => line.agreed)) return current;
  return current.map((line) => {
    const { agreed, ...rest } = line;
    if (!agreed || line.priceTouched) return rest;
    return { ...rest, price: (agreed.listPriceCents / 100).toFixed(2) };
  });
}

function withAgreedPrices(current: SaleLine[], byVariant: Map<string, AgreedPrice>): SaleLine[] {
  return current.map((line) => {
    const found = line.variantId ? byVariant.get(line.variantId) : undefined;
    if (!found) return line;
    return {
      ...line,
      agreed: found,
      ...(line.priceTouched ? {} : { price: (found.unitPriceCents / 100).toFixed(2) }),
    };
  });
}

export function useAgreedPricing(
  customer: CustomerSummary | null,
  propertyId: string | null,
  lines: SaleLine[],
  setLines: Dispatch<SetStateAction<SaleLine[]>>
): void {
  const { mutate: askWhatTheyPay } = useAgreedPrices();
  // The last basket asked about. An answer for a basket she has since changed
  // is thrown away: at a counter the slow answer is always the stale one.
  const asked = useRef('');
  useEffect(() => {
    const key = basketKey(customer?.id ?? null, propertyId, lines);
    if (key === asked.current) return;
    asked.current = key;
    const basket = lines.flatMap((line) =>
      line.variantId === null ? [] : [{ variantId: line.variantId, quantity: line.quantity }]
    );
    if (!customer || basket.length === 0) {
      setLines(backToListPrices);
      return;
    }
    askWhatTheyPay(
      { customerId: customer.id, propertyId, lines: basket },
      {
        onSuccess: (byVariant) => {
          if (asked.current !== key) return;
          setLines((current) => withAgreedPrices(current, byVariant));
        },
        // Silent. A counter that cannot reach the pricing engine still has the
        // catalog price in the box and a person who can type over it.
        onError: () => undefined,
      }
    );
  }, [customer, propertyId, lines, askWhatTheyPay, setLines]);
}
