// Persistence for purchased outbound shipping labels — the FulfillmentLabel
// model (mirrors ReturnLabel's shape for the reverse-direction case).
// Isolated from shipping-provider-bridge.ts so the provider-calling logic
// doesn't get tangled with the Prisma writes.

import { withTenant } from '@sparx/db';

import type { ServiceContext } from '../errors';

export async function recordFulfillmentLabel(
  ctx: ServiceContext,
  input: {
    fulfillmentId: string;
    providerSlug: string;
    labelRef: string;
    trackingNumber: string;
    trackingUrl: string;
    labelMediaId: string;
    costCents: number;
  }
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.fulfillmentLabel.create({
      data: {
        tenantId: ctx.tenantId,
        fulfillmentId: input.fulfillmentId,
        providerSlug: input.providerSlug,
        labelRef: input.labelRef,
        trackingNumber: input.trackingNumber || null,
        trackingUrl: input.trackingUrl || null,
        labelMediaId: input.labelMediaId,
        costCents: input.costCents,
      },
    })
  );
}

export async function findFulfillmentIdByTrackingNumber(
  ctx: ServiceContext,
  trackingNumber: string
): Promise<string | null> {
  const row = await withTenant(ctx, (tx) =>
    tx.fulfillmentLabel.findFirst({ where: { trackingNumber }, select: { fulfillmentId: true } })
  );
  return row?.fulfillmentId ?? null;
}

export async function markFulfillmentLabelVoided(
  ctx: ServiceContext,
  fulfillmentId: string,
  labelRef: string
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.fulfillmentLabel.updateMany({
      where: { fulfillmentId, labelRef },
      data: { voidedAt: new Date() },
    })
  );
}

export interface FulfillmentLabelRow {
  id: string;
  providerSlug: string;
  labelRef: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelMediaId: string | null;
  costCents: number;
  voidedAt: string | null;
  createdAt: string;
}

export async function listFulfillmentLabels(
  ctx: ServiceContext,
  fulfillmentId: string
): Promise<FulfillmentLabelRow[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.fulfillmentLabel.findMany({ where: { fulfillmentId }, orderBy: { createdAt: 'desc' } })
  );
  return rows.map((row) => ({
    id: row.id,
    providerSlug: row.providerSlug,
    labelRef: row.labelRef,
    trackingNumber: row.trackingNumber,
    trackingUrl: row.trackingUrl,
    labelMediaId: row.labelMediaId,
    costCents: row.costCents,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
