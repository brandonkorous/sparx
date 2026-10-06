// What the silica buy box's form asks the cart for.
//
// The buy box is a plain HTML form (`@wizeworks/silica-catalog` `addToCartForm`) and
// the silica `form` behavior hands its fields to the storefront as strings. This turns
// them into the cart call, in one place, so a field the form posts cannot be dropped
// on the way to the cart without a test going red. Two already had been: the
// schedule (issue 739) and the old-part choice (issue 057) are both choices the
// shopper makes on the page and the server re-checks.

import { cadenceFromKey, type RepeatCadence } from '@wizeworks/commerce-schemas';

/** A submitted form field: one value, several (a repeated name), or none. */
export type FormValue = string | string[] | undefined;

/** First value of a form field (a repeated name gathers to an array). */
export function firstValue(v: FormValue): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export interface AddToCartRequest {
  variantId: string;
  quantity: number;
  /** Delivered again on this schedule; undefined is bought once (issue 739). */
  repeat: RepeatCadence | undefined;
  /** Send the old part first and pay no core deposit (issue 057). */
  coreFirst: boolean;
}

/**
 * The cart call a buy box submit asks for, or null when it names no variant.
 *
 * The empty-variant guard is load-bearing, not defensive noise: a product with no live
 * variant resolves `variantId` to '', and `required` is INERT on a hidden input, so
 * `form.checkValidity()` passes and the submit dispatches anyway.
 */
export function addToCartRequest(values: Record<string, FormValue>): AddToCartRequest | null {
  const variantId = firstValue(values.variantId);
  if (!variantId) return null;
  const quantity = Number(firstValue(values.quantity) ?? '1') || 1;
  // Empty is Buy once; anything else must be one of the offered schedules, and the
  // cart checks it again on the server.
  const repeatKey = firstValue(values.repeat);
  const repeat = repeatKey ? (cadenceFromKey(repeatKey) ?? undefined) : undefined;
  // "1" is send the old part first; anything else, the pre-chosen empty value
  // included, pays the deposit. The cart refuses it on a part that does not offer it.
  const coreFirst = firstValue(values.coreFirst) === '1';
  return { variantId, quantity, repeat, coreFirst };
}
