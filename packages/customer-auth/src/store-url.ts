// Resolves the shopper-facing base URL for the ambient tenant's storefront — its
// custom primary domain if set, else the <slug>.sparx.zone subdomain. Used to
// build the password-reset link so the email points at the shopper's ACTUAL
// storefront, never a client-supplied origin (a token-phishing vector). Mirrors
// the api-rest `siteBaseUrl` helper.

import { prisma, tenantStore } from '@sparx/db';

export async function resolveStoreBaseUrl(): Promise<string> {
  const tenantId = tenantStore.getTenantIdOrThrow();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, settings: true },
  });
  const settings = tenant?.settings as { primaryDomain?: unknown } | null;
  const domain =
    settings && typeof settings.primaryDomain === 'string' && settings.primaryDomain
      ? settings.primaryDomain
      : `${tenant?.slug ?? ''}.sparx.zone`;
  return `https://${domain}`;
}
