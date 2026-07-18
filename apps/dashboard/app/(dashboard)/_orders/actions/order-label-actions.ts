'use server';

// Outbound carrier label Server Actions — adapters over api-rest's
// /v1/orders/:id/fulfillments/:fulfillmentId/{rates,buy-label,void-label,track}
// endpoints (the real Shippo integration, docs/09). Mirrors the pattern in
// order-fulfillment-actions.ts.

import { revalidateOrder } from './revalidate';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

export interface RateOptionDTO {
  rateRef: string;
  providerSlug: string;
  carrier: string;
  service: string;
  amountCents: number;
  currency: string;
  estimatedDeliveryDays?: number;
}

export interface LabelResultDTO {
  fulfillmentId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelMediaId: string;
  carrier: string;
  costCents: number;
}

export interface FulfillmentLabelDTO {
  id: string;
  providerSlug: string;
  labelRef: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelMediaId: string;
  costCents: number;
  voidedAt: string | null;
  createdAt: string;
}

export async function quoteOutboundRatesAction(input: {
  orderId: string;
  fulfillmentId: string;
}): Promise<ActionResult<RateOptionDTO[]>> {
  return restAction(() =>
    api.get<RateOptionDTO[]>(
      `/v1/orders/${input.orderId}/fulfillments/${input.fulfillmentId}/rates`
    )
  );
}

export async function listFulfillmentLabelsAction(input: {
  orderId: string;
  fulfillmentId: string;
}): Promise<ActionResult<FulfillmentLabelDTO[]>> {
  return restAction(() =>
    api.get<FulfillmentLabelDTO[]>(
      `/v1/orders/${input.orderId}/fulfillments/${input.fulfillmentId}/labels`
    )
  );
}

export async function buyOutboundLabelAction(input: {
  orderId: string;
  fulfillmentId: string;
  rateRef: string;
}): Promise<ActionResult<LabelResultDTO>> {
  return restAction(async () => {
    const result = await api.post<LabelResultDTO>(
      `/v1/orders/${input.orderId}/fulfillments/${input.fulfillmentId}/buy-label`,
      { rateRef: input.rateRef }
    );
    revalidateOrder(input.orderId);
    return result;
  });
}

export async function voidOutboundLabelAction(input: {
  orderId: string;
  fulfillmentId: string;
  labelRef: string;
}): Promise<ActionResult<{ voided: boolean }>> {
  return restAction(async () => {
    const result = await api.post<{ voided: boolean }>(
      `/v1/orders/${input.orderId}/fulfillments/${input.fulfillmentId}/void-label`,
      { labelRef: input.labelRef }
    );
    revalidateOrder(input.orderId);
    return result;
  });
}
