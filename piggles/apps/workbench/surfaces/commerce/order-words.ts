'use client';

// The plain words for the values an order stores — payment states, ways money
// moved, delivery states, carriers and channels.

import { channelLabel as sharedChannelLabel } from '../../lib/console/channels';
import { paymentMethodLabels } from '../../lib/payment-methods';
import type { Order, OrderFulfillment } from './order-types';

/** Plain-word labels for a payment record's own status, which uses card-industry
 *  words nobody outside payments has met. */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting',
  authorized: 'Held, not taken',
  captured: 'Taken',
  failed: 'Failed',
  voided: 'Cancelled',
  refunded: 'Given back',
};

/**
 * How the money arrived, in the words a business uses.
 *
 * The pane printed `payment.processor` raw, so a cash sale read "$33.00 ·
 * manual" — a column value on a screen about somebody handing over notes. Same
 * reasoning as PAYMENT_STATUS_LABELS above: "captured" means "taken", and a
 * payment processor's vocabulary is not the shopkeeper's.
 *
 * The words themselves now live in lib/payment-methods, because four panes
 * named this same column and disagreed on how to spell a cheque. This list is
 * only which processors the commerce panes expect to see.
 */
export const PAYMENT_PROCESSOR_LABELS: Record<string, string> = paymentMethodLabels([
  'manual',
  'card',
  'check',
  'ach',
  'wire',
  'net_terms',
  'stripe',
  'paypal',
]);

/** True when the money never went through a gateway, so there is nothing to
 *  send it back to. Drives the refund wording, which used to promise every
 *  refund went "back to the card it was paid with" — including a cash sale.
 *
 *  `card` counts: it means a card on the business's OWN reader, which nothing
 *  here charged and nothing here can credit. `stripe`/`paypal` are the gateways. */
export function paidByHand(processor: string): boolean {
  return ['manual', 'card', 'check', 'ach', 'wire'].includes(processor);
}

export const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Being packed',
  shipped: 'On the way',
  delivered: 'Delivered',
  failed: 'Delivery failed',
  cancelled: 'Cancelled',
};

/** The API's `Carrier` enum in the words a business uses. `pickup` is handled
 *  by `shipmentHeadline` rather than listed here — nothing was carried. */
const CARRIER_LABELS: Record<string, string> = {
  ups: 'UPS',
  usps: 'USPS',
  fedex: 'FedEx',
  dhl: 'DHL',
  digital: 'Sent electronically',
  dropship: 'Sent by the supplier',
  other: 'Another courier',
};

/**
 * The one line at the top of a shipment row.
 *
 * A collection is not a delivery by a carrier called "pickup", so it does not
 * render as one. `service` already holds the words the shopper chose ("Collect
 * in person"), which reads whole on its own — the same reason `describeRate`
 * does not prefix the carrier onto it.
 */
export function shipmentHeadline(shipment: OrderFulfillment): string {
  if (shipment.carrier === 'pickup') return shipment.service ?? 'Collected in person';
  const carrier = shipment.carrier ? (CARRIER_LABELS[shipment.carrier] ?? shipment.carrier) : '';
  return [carrier, shipment.service].filter(Boolean).join(' · ') || 'Delivery';
}

/** "Delivered" is right for something a courier brought and wrong for something
 *  the customer walked in and took. Same row, same column, different fact. */
export function shipmentStatusLabel(shipment: OrderFulfillment): string {
  if (shipment.carrier === 'pickup' && shipment.status === 'delivered') return 'Collected';
  return FULFILLMENT_STATUS_LABELS[shipment.status] ?? shipment.status;
}

export const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: 'In progress',
  completed: 'Given back',
  failed: 'Failed',
};

/** Where an order came from, in one phrase. The words themselves live in
 *  lib/console/channels.ts — one vocabulary for every screen that names a
 *  channel, so an order and a report cannot disagree about the same sale. */
export function channelLabel(order: Order): string {
  return sharedChannelLabel(order.channel, order.source);
}
