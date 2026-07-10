// @sparx/provider-shippo — Shippo ShippingProvider + sparx Shipping
// white-label. `shippoShipping` is shared by both bundles (methods use a
// `this` parameter so `this.metadata.slug` resolves correctly whichever
// bundle they're invoked through). SDK client/error handling lives in
// ./client.ts, request/response mapping in ./mapping.ts.

import type { RateOption, ShipmentRequest } from '@sparx/commerce-schemas';
import {
  ProviderHardError,
  registerProvider,
  WebhookVerificationError,
} from '@sparx/integration-framework';
import type {
  ProviderBundle,
  ProviderRunContext,
  ShippingLabel,
  ShippingProvider,
  TrackingStatus,
  WebhookEvent,
} from '@sparx/integration-framework';

import { callShippo, shippoClientFor } from './client';
import {
  createShippoShipment,
  downloadLabelBase64,
  formatLocation,
  mapTrackingStatus,
  messagesToText,
  resolvePurchaseRate,
  toCents,
} from './mapping';
import { shippoMetadata, sparxShippingMetadata } from './metadata';

const shippoShipping: ShippingProvider = {
  metadata: shippoMetadata,

  async rateShipment(
    this: ShippingProvider,
    ctx: ProviderRunContext,
    request: ShipmentRequest
  ): Promise<RateOption[]> {
    const client = await shippoClientFor(ctx);
    const shipment = await createShippoShipment(client, ctx, request);
    let rates = shipment.rates;
    if (request.carrierServiceFilter?.length) {
      const allow = new Set(request.carrierServiceFilter.map((s) => s.toLowerCase()));
      rates = rates.filter((r) => allow.has((r.servicelevel.token ?? '').toLowerCase()));
    }
    const slug = this.metadata.slug;
    return rates.map((r) => ({
      rateRef: r.objectId,
      providerSlug: slug,
      carrier: r.provider,
      service: r.servicelevel.name ?? r.servicelevel.token ?? r.provider,
      amountCents: toCents(r.amount),
      currency: r.currency,
      estimatedDeliveryDays: r.estimatedDays,
      isFreight: false,
    }));
  },

  async buyLabel(
    ctx: ProviderRunContext,
    input: { rateRef: string } | { request: ShipmentRequest; service: string; carrier: string }
  ): Promise<ShippingLabel> {
    const client = await shippoClientFor(ctx);
    const rate = await resolvePurchaseRate(client, ctx, input);

    const transaction = await callShippo(() =>
      client.transactions.create({ rate: rate.objectId, labelFileType: 'PDF', async: false })
    );
    if (transaction.status !== 'SUCCESS' || !transaction.labelUrl || !transaction.trackingNumber) {
      throw new ProviderHardError(
        'shippo',
        messagesToText(transaction.messages) ||
          `Shippo could not issue a label (status=${transaction.status ?? 'unknown'}).`
      );
    }

    const labelImageBase64 = await downloadLabelBase64(transaction.labelUrl);

    return {
      labelRef: transaction.objectId ?? rate.objectId,
      trackingNumber: transaction.trackingNumber,
      trackingUrl: transaction.trackingUrlProvider ?? '',
      carrier: rate.provider,
      service: rate.servicelevel.name ?? rate.servicelevel.token ?? rate.provider,
      costCents: toCents(rate.amount),
      labelImageBase64,
      labelImageFormat: 'pdf',
    };
  },

  async track(
    ctx: ProviderRunContext,
    input: { trackingNumber: string; carrier: string }
  ): Promise<TrackingStatus> {
    const client = await shippoClientFor(ctx);
    const track = await callShippo(() =>
      client.trackingStatus.get(input.trackingNumber, input.carrier)
    );
    const latest = track.trackingStatus;
    return {
      status: mapTrackingStatus(latest?.status),
      carrierStatusText: latest?.statusDetails ?? '',
      lastEventAt: (latest?.statusDate ?? new Date()).toISOString(),
      estimatedDeliveryAt: track.eta?.toISOString(),
      events: track.trackingHistory.map((event) => ({
        at: (event.statusDate ?? new Date()).toISOString(),
        status: mapTrackingStatus(event.status),
        location: formatLocation(event.location),
        description: event.statusDetails,
      })),
    };
  },

  async voidLabel(ctx: ProviderRunContext, labelRef: string): Promise<void> {
    const client = await shippoClientFor(ctx);
    const refund = await callShippo(() =>
      client.refunds.create({ transaction: labelRef, async: false })
    );
    if (refund.status === 'ERROR') {
      throw new ProviderHardError(
        'shippo',
        `Shippo rejected the void request for label ${labelRef}.`
      );
    }
  },

  verifyWebhook(input: { rawBody: string; signature: string; secret: string }): WebhookEvent {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.rawBody);
    } catch {
      throw new WebhookVerificationError(
        'shippo',
        'Malformed Shippo webhook payload (not valid JSON).'
      );
    }
    const body = parsed as { event?: string; test?: boolean; data?: Record<string, unknown> };
    const eventType = body.event ?? 'unknown';
    const data = body.data ?? {};
    // Shippo webhooks don't carry a stable per-delivery event id; synthesize
    // one from the tracked object's identity + last-updated timestamp so
    // Shippo's at-least-once redeliveries still dedupe on our unique index.
    const objectId =
      (data.objectId as string | undefined) ??
      (data.trackingNumber as string | undefined) ??
      'unknown';
    const updatedAt =
      (data.objectUpdated as string | undefined) ??
      (data.trackingStatus as { statusDate?: string } | undefined)?.statusDate ??
      '';
    return {
      providerEventId: `${eventType}:${objectId}:${updatedAt}`,
      providerEventType: eventType,
      payload: parsed,
    };
  },
};

export const shippoBundle: ProviderBundle = {
  metadata: shippoMetadata,
  shipping: shippoShipping,
};

// sparx-shipping's config schema deliberately has no apiToken field (it's
// meant to ride on a sparx-owned master Shippo account instead of a
// per-tenant key). That master-account wiring — and the postage
// cost-recovery/markup it requires before real money can flow — doesn't
// exist yet, so shippoClientFor() will throw a clear ProviderConfigurationError
// for any sparx-shipping installation until that billing decision is made.
// This is intentional, not a bug: it fails loudly instead of silently
// billing sparx's own Shippo balance.
export const sparxShippingBundle: ProviderBundle = {
  metadata: sparxShippingMetadata,
  shipping: { ...shippoShipping, metadata: sparxShippingMetadata },
};

export function registerShippoProviders(): void {
  registerProvider(shippoBundle);
  registerProvider(sparxShippingBundle);
}
