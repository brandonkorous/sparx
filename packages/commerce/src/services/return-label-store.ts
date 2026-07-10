// Persistence for purchased return shipping labels (the ReturnLabel
// model — already existed with the right shape; only the write path was
// missing, see return-service.approve()).

import { withTenant } from '@sparx/db';

import type { ServiceContext } from '../errors';

export async function recordReturnLabel(
  ctx: ServiceContext,
  input: {
    returnId: string;
    providerSlug: string;
    labelRef: string;
    trackingNumber: string;
    trackingUrl: string;
    labelMediaId: string;
    costCents: number;
  }
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.returnLabel.create({
      data: {
        tenantId: ctx.tenantId,
        returnId: input.returnId,
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
