// Request/response mapping between sparx's provider-agnostic shapes and
// Shippo's SDK types, plus the shared shipment-creation + label-download
// helpers used by both rateShipment and buyLabel.

import type { Shippo } from 'shippo';
import type * as components from 'shippo/models/components';

import type {
  AddressSnapshotType as AddressSnapshot,
  ShipmentPackage,
  ShipmentRequest,
} from '@wizeworks/commerce-schemas';
import { ProviderHardError, ProviderTransientError } from '@wizeworks/integration-framework';
import type { ProviderRunContext, TrackingStatus } from '@wizeworks/integration-framework';

import { callShippo } from './client';

export function toShippoAddress(addr: AddressSnapshot): components.AddressCreateRequest {
  return {
    name: addr.recipientName,
    company: addr.company,
    street1: addr.line1,
    street2: addr.line2,
    city: addr.city,
    state: addr.region,
    zip: addr.postalCode,
    country: addr.country,
    phone: addr.phone,
    email: addr.email,
  };
}

export function toShippoParcel(pkg: ShipmentPackage): components.ParcelCreateRequest {
  return {
    massUnit: 'g',
    weight: String(pkg.weight),
    distanceUnit: 'mm',
    length: String(pkg.dimensions.lengthMm),
    width: String(pkg.dimensions.widthMm),
    height: String(pkg.dimensions.heightMm),
  };
}

export function toCents(amount: string | undefined): number {
  const value = Number.parseFloat(amount ?? '0');
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function messagesToText(messages: { text?: string }[] | undefined): string {
  return (messages ?? [])
    .map((m) => m.text)
    .filter((t): t is string => Boolean(t))
    .join('; ');
}

export function mapTrackingStatus(status: string | undefined): TrackingStatus['status'] {
  switch (status) {
    case 'PRE_TRANSIT':
      return 'pre_transit';
    case 'TRANSIT':
      return 'in_transit';
    case 'DELIVERED':
      return 'delivered';
    case 'RETURNED':
      return 'returned';
    case 'FAILURE':
      return 'failure';
    default:
      return 'unknown';
  }
}

export function formatLocation(
  loc: { city?: string; state?: string; country?: string } | undefined
): string | undefined {
  if (!loc) return undefined;
  return [loc.city, loc.state, loc.country].filter(Boolean).join(', ') || undefined;
}

export async function createShippoShipment(
  client: Shippo,
  ctx: ProviderRunContext,
  request: ShipmentRequest
): Promise<components.Shipment> {
  const defaultCarrierAccounts = Array.isArray(ctx.config.defaultCarrierAccounts)
    ? (ctx.config.defaultCarrierAccounts as unknown[]).filter(
        (v): v is string => typeof v === 'string'
      )
    : undefined;
  const shipment = await callShippo(() =>
    client.shipments.create({
      addressFrom: toShippoAddress(request.fromAddress),
      addressTo: toShippoAddress(request.toAddress),
      parcels: request.packages.map(toShippoParcel),
      async: false,
      ...(defaultCarrierAccounts?.length ? { carrierAccounts: defaultCarrierAccounts } : {}),
    })
  );
  if (shipment.status === 'ERROR') {
    throw new ProviderHardError(
      'shippo',
      messagesToText(shipment.messages) || 'Shippo could not rate this shipment.'
    );
  }
  return shipment;
}

/** Shippo returns a label as a hosted URL, not inline bytes — the caller
 *  contract (ShippingLabel.labelImageBase64) needs the actual payload so
 *  it can be re-uploaded to our own media storage. */
export async function downloadLabelBase64(labelUrl: string): Promise<string> {
  return callShippo(async () => {
    const res = await fetch(labelUrl);
    if (!res.ok) {
      throw new ProviderTransientError(
        'shippo',
        `Could not download the purchased label (${res.status}).`
      );
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.toString('base64');
  });
}

export async function resolvePurchaseRate(
  client: Shippo,
  ctx: ProviderRunContext,
  input: { rateRef: string } | { request: ShipmentRequest; service: string; carrier: string }
): Promise<components.Rate> {
  if ('rateRef' in input) {
    return callShippo(() => client.rates.get(input.rateRef));
  }
  const shipment = await createShippoShipment(client, ctx, input.request);
  const match = shipment.rates.find(
    (r) =>
      (r.servicelevel.token ?? '').toLowerCase() === input.service.toLowerCase() &&
      r.provider.toLowerCase() === input.carrier.toLowerCase()
  );
  if (!match) {
    throw new ProviderHardError(
      'shippo',
      `No Shippo rate matched carrier="${input.carrier}" service="${input.service}" for this shipment.`
    );
  }
  return match;
}
