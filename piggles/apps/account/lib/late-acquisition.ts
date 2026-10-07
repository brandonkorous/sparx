import 'server-only';
import { type Prisma, prisma } from '@wizeworks/db';
import type { SignUpAcquisition } from '@wizeworks/auth';

/** A fresh business is one made in the last hour: long enough for a slow Google
 *  round trip, short enough that an old link can never rewrite a real source. */
const FRESH_MS = 60 * 60 * 1000;

/**
 * Record a Google signup's source, ONCE: only on a business made in the last hour
 * that has no source yet. The password path writes it at creation; this is the
 * same write for the path that cannot. `tenants` is the non-RLS dispatch row.
 */
export async function recordAcquisitionOnce(
  tenantId: string,
  acq: SignUpAcquisition | null
): Promise<void> {
  if (!acq) return;
  await prisma.tenant.updateMany({
    where: {
      id: tenantId,
      acquiredAt: null,
      acquisitionChannel: null,
      acquisitionSource: null,
      createdAt: { gte: new Date(Date.now() - FRESH_MS) },
    },
    data: {
      acquisitionChannel: acq.channel,
      acquisitionSource: acq.source,
      acquisitionCampaign: acq.campaign,
      acquiredAt: new Date(),
      ...(acq.firstTouch && {
        acquisitionFirstTouch: acq.firstTouch as unknown as Prisma.InputJsonValue,
      }),
      ...(acq.lastTouch && {
        acquisitionLastTouch: acq.lastTouch as unknown as Prisma.InputJsonValue,
      }),
    },
  });
}
