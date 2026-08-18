// Applies a verified shipping-provider webhook event (tracking updates)
// to the matching OrderFulfillment. Called inline from the generic
// provider webhook route right after verify+persist — no separate worker
// exists in this repo for this shape, and the pattern elsewhere
// (stripe-billing.ts) is the same "always-200, reconcile inline" style.

import { orderFulfillmentsService } from '@wizeworks/crm';

import type { ServiceContext } from '../errors';
import { findFulfillmentIdByTrackingNumber } from './fulfillment-label-store';

// Shippo's raw webhook JSON is snake_case (its public REST API convention);
// the SDK's camelCase types are only produced when payloads flow through
// its own parser, which provider-shippo's verifyWebhook() deliberately
// doesn't use (it just JSON.parses the raw body). Check both shapes so a
// future provider that DOES send camelCase still works.
interface RawTrackData {
  tracking_number?: string;
  trackingNumber?: string;
  tracking_status?: { status?: string };
  trackingStatus?: { status?: string };
}

function extractTrackData(payload: unknown): { trackingNumber: string; status?: string } | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: RawTrackData }).data;
  if (!data) return null;
  const trackingNumber = data.tracking_number ?? data.trackingNumber;
  if (!trackingNumber) return null;
  const status = data.tracking_status?.status ?? data.trackingStatus?.status;
  return { trackingNumber, status };
}

function mapToFulfillmentStatus(
  providerStatus: string | undefined
): 'shipped' | 'delivered' | 'failed' | null {
  switch (providerStatus) {
    case 'PRE_TRANSIT':
    case 'TRANSIT':
      return 'shipped';
    case 'DELIVERED':
      return 'delivered';
    case 'FAILURE':
    case 'RETURNED':
      return 'failed';
    default:
      return null;
  }
}

/** Best-effort — a webhook the platform can't map to a known fulfillment
 *  (unrecognized event shape, tracking number not ours, ambiguous status)
 *  is silently ignored. The route around this already acks 200
 *  regardless, per the provider-webhook contract (don't make a carrier
 *  retry forever over something we chose not to act on). */
export async function dispatchShippingTrackingWebhook(
  ctx: ServiceContext,
  input: { rawPayload: unknown }
): Promise<void> {
  const track = extractTrackData(input.rawPayload);
  if (!track) return;

  const fulfillmentId = await findFulfillmentIdByTrackingNumber(ctx, track.trackingNumber);
  if (!fulfillmentId) return;

  const status = mapToFulfillmentStatus(track.status);
  if (!status) return;

  await orderFulfillmentsService.updateFulfillment(ctx, { fulfillmentId, status });
}
