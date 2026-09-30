// What is travelling on a return, and what a settled swap moved. A return can
// have a parcel going each way in one list, told apart only by `direction`, so
// every question here names which parcel it means. Pure, so it is tested.

import { carrierLabel } from '@wizeworks/commerce-schemas';

import type { SettleExchangeBody } from './returns-data';
import type { ReplacementShipmentBody, ReturnLabelRecord } from './returns-types';

/** The prepaid label the customer was given to send the goods back with. */
export function inboundLabel(labels: ReturnLabelRecord[]): ReturnLabelRecord | undefined {
  return labels.find((row) => row.direction === 'inbound');
}

/** The replacement travelling to the customer, if it has been posted. */
export function outboundShipment(labels: ReturnLabelRecord[]): ReturnLabelRecord | undefined {
  return labels.find((row) => row.direction === 'outbound');
}

/** A settled SWAP whose replacement has no tracking yet: settling and posting
 *  are separate moments, so the number needs a way back in (issue 452). A
 *  refund sends nothing, so it never asks. */
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

/** The form as the server should hear it, or undefined with no tracking number
 *  (a carrier alone gives the customer nothing to follow). Blanks are dropped,
 *  since a stored `''` reads back as an answer. */
export function replacementShipmentBody(form: ShipmentForm): ReplacementShipmentBody | undefined {
  const trackingNumber = form.trackingNumber.trim();
  if (trackingNumber === '') return undefined;

  const body: ReplacementShipmentBody = { trackingNumber };
  const carrier = form.carrier.trim();
  if (carrier !== '') body.carrier = carrier;
  // Only meaningful alongside 'other'; otherwise a leftover second answer.
  const carrierOther = form.carrierOther.trim();
  if (carrier === 'other' && carrierOther !== '') body.carrierOther = carrierOther;
  const trackingUrl = form.trackingUrl.trim();
  if (trackingUrl !== '') body.trackingUrl = trackingUrl;
  return body;
}

/** What to call the carrier on screen. A typed "Someone else" name is the
 *  answer itself, never the word "other". */
export function shipmentCarrierName(row: { carrier: string | null; providerSlug: string }): string {
  // Through the shared map, never raw: the column holds a code ("usps"). A
  // typed name is not in the map and comes back unchanged.
  if (row.carrier) return carrierLabel(row.carrier);
  // A bought label carries its carrier inside; the provider is the nearest fact.
  return row.providerSlug === 'manual' ? '' : row.providerSlug;
}

/** What a settled swap just did, every clause measured: goods restock only
 *  after an inspection, so a zero count says nothing is written down yet
 *  rather than claiming a restock. */
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

/** What settling a swap sends. The team's note was typed on the body and never
 *  sent; the server appends it to the return's note, so it reads back on the
 *  return. An empty note is no note. */
export function settleExchangeBody(
  replacementVariantId: string,
  shipping: ShipmentForm,
  staffNote: string
): SettleExchangeBody {
  const shipment = replacementShipmentBody(shipping);
  const note = staffNote.trim();
  return {
    replacementVariantId,
    quantity: 1,
    ...(note ? { staffNote: note } : {}),
    ...(shipment ? { shipment } : {}),
  };
}
