// What is travelling on a return, whether anybody has said so, and what actually
// moved when a swap was settled.
//
// A return can have a parcel going each way: the prepaid label the customer
// sends the goods back with, and the replacement going out to them. Both are
// rows in the same list and only a field tells them apart, so every question
// about one of them is a question a screen can get wrong by asking it of the
// other.
//
// In a `.ts` file rather than beside the pane because these are the answers
// worth testing — the pane only decides which words to draw around them.

import { carrierLabel } from '@wizeworks/commerce-schemas';

import type { ReplacementShipmentBody, ReturnLabelRecord } from './returns-data';

/** The prepaid label the customer was given to send the goods back with. */
export function inboundLabel(labels: ReturnLabelRecord[]): ReturnLabelRecord | undefined {
  return labels.find((row) => row.direction === 'inbound');
}

/** The replacement travelling to the customer, if it has been posted. */
export function outboundShipment(labels: ReturnLabelRecord[]): ReturnLabelRecord | undefined {
  return labels.find((row) => row.direction === 'outbound');
}

/**
 * A swap is settled and nobody has said how the replacement went out.
 *
 * This is the work list, and the reason it exists is that the two moments come
 * apart: a shop settles the swap while the customer is waiting and walks to the
 * post office afterwards. Without a route back in, the tracking number arrives
 * five minutes after the screen closed and has nowhere to go — the same shape as
 * goods that could no longer be recorded once a return was settled (issue 452).
 *
 * Only ever true of a SWAP. A refund sends nothing, so there is nothing to track
 * and no row to ask for.
 */
export function needsShipmentRecord(detail: {
  status: string;
  labels: ReturnLabelRecord[];
}): boolean {
  if (detail.status !== 'exchanged') return false;
  return outboundShipment(detail.labels) === undefined;
}

/** What the form holds while somebody is filling it in. */
export interface ShipmentForm {
  carrier: string;
  carrierOther: string;
  trackingNumber: string;
  trackingUrl: string;
}

export const EMPTY_SHIPMENT_FORM: ShipmentForm = {
  carrier: '',
  carrierOther: '',
  trackingNumber: '',
  trackingUrl: '',
};

/**
 * The form, as the server should hear it, or NOTHING.
 *
 * Undefined when there is no tracking number, and that is the whole rule. A
 * carrier on its own records that a parcel went by USPS and gives the customer
 * nothing to follow, so it is not worth a row and must not produce an email
 * whose only job is a number it does not have.
 *
 * Blank optional fields are dropped rather than sent as empty strings: a stored
 * `''` reads back as "somebody answered this" and would print a carrier row with
 * nothing in it.
 */
export function replacementShipmentBody(form: ShipmentForm): ReplacementShipmentBody | undefined {
  const trackingNumber = form.trackingNumber.trim();
  if (trackingNumber === '') return undefined;

  const body: ReplacementShipmentBody = { trackingNumber };
  const carrier = form.carrier.trim();
  if (carrier !== '') body.carrier = carrier;
  // Only meaningful alongside 'other'; on any named carrier it is a leftover
  // from somebody changing their mind, and sending it would store a second
  // answer to a question already answered.
  const carrierOther = form.carrierOther.trim();
  if (carrier === 'other' && carrierOther !== '') body.carrierOther = carrierOther;
  const trackingUrl = form.trackingUrl.trim();
  if (trackingUrl !== '') body.trackingUrl = trackingUrl;
  return body;
}

/**
 * What to call the carrier on screen.
 *
 * The typed name wins when they chose "Someone else", because that IS the
 * answer — showing "other" would replace a courier's name with the fact that it
 * was not on our list.
 */
export function shipmentCarrierName(row: { carrier: string | null; providerSlug: string }): string {
  // Through the shared map, never printed raw. The column holds a CODE for any
  // carrier on the list, so a swap posted by USPS put the word "usps" on Devi's
  // own screen and in her customer's email — the same defect the shipping
  // confirmation had before that map existed, in a second place, a day later. A
  // name somebody typed is not a code, is not in the map, and comes back
  // unchanged, which is what lets one call cover both kinds of answer.
  if (row.carrier) return carrierLabel(row.carrier);
  // A label bought through an integration carries the carrier inside itself; the
  // provider is the nearest true thing we hold.
  return row.providerSlug === 'manual' ? '' : row.providerSlug;
}

/**
 * What to tell her a settled swap just did.
 *
 * Every clause is measured rather than assumed. The old sentence opened with
 * "One came back on the shelf" whatever happened, and goods go back on a shelf
 * only once an inspection says they are fit to sell — so a swap settled without
 * one claimed a restock while the pane behind the toast said, in the same
 * breath, that nothing had been written down about the goods. When the count is
 * zero the sentence now says the true thing and points at the work left.
 */
export function swapSettledMessage(
  result: { unitsRestocked: number },
  sentTracking: boolean
): string {
  const went = sentTracking
    ? 'The replacement went out with its tracking number, and no money moved.'
    : 'The replacement went out, and no money moved.';
  if (result.unitsRestocked <= 0) {
    return `${went} Nothing has been written down yet about what came back.`;
  }
  const back =
    result.unitsRestocked === 1
      ? 'One came back on the shelf.'
      : `${result.unitsRestocked} came back on the shelf.`;
  return `${back} ${went}`;
}
