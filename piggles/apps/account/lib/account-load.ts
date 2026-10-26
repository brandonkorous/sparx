import { prisma } from '@wizeworks/db';
import { capacityReport } from '@wizeworks/usage';
import { readBilling } from './billing';
import { readConsent } from './consent';

// Everything the account home reads, started at once: one wave, not three.

export interface AccountUser {
  id: string;
  tenantId: string;
  /** The business the person's own row belongs to; consent lives there. */
  homeTenantId: string;
}

function readTenant(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      slug: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      platformBrand: true,
    },
  });
}

/** The address her site is really served at, READ rather than composed (issue #089). */
function readSiteAddress(tenantId: string) {
  return prisma.domain.findFirst({
    where: { tenantId, type: 'subdomain' },
    orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
    select: { host: true },
  });
}

export async function loadAccountHome(user: AccountUser) {
  // A real Promise, so the capacity read and Promise.all share one query.
  const tenant = Promise.resolve(readTenant(user.tenantId));
  // The tenant's own brand column decides the ceilings, not the deployment.
  const capacity = tenant.then((t) => capacityReport(user.tenantId, t?.platformBrand ?? null));
  const [t, siteAddress, billing, consent, report] = await Promise.all([
    tenant,
    readSiteAddress(user.tenantId),
    readBilling(user.tenantId),
    readConsent(user.id, user.homeTenantId),
    capacity,
  ]);
  return { tenant: t, siteAddress, billing, consent, capacity: report };
}
