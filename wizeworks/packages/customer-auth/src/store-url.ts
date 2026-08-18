// Resolves the shopper-facing base URL for the ambient tenant's site. Used to
// build the password-reset link so the email points at the shopper's ACTUAL
// site, never a client-supplied origin (a token-phishing vector). Mirrors the
// api-rest `siteBaseUrl` helper.
//
// The fallback used to be a CONSTRUCTED `<slug>.sparx.zone`, which named one
// brand's zone for every tenant on the platform — so a shopper of a Piggles
// business asked to reset their password was sent to a host under another
// company's domain, which does not serve that site.
//
// The fix is not a second literal. `provisionTenant` writes a canonical Domain
// row for every tenant at signup, in whichever zone that tenant's brand uses, so
// the answer is already in the database and the only correct move is to read it.
// Constructing it was re-deriving a fact that is stored.

import { prisma, tenantStore } from '@wizeworks/db';

export async function resolveStoreBaseUrl(): Promise<string> {
  const tenantId = tenantStore.getTenantIdOrThrow();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, settings: true },
  });

  // An explicitly chosen primary domain wins — it is the tenant's own answer.
  const settings = tenant?.settings as { primaryDomain?: unknown } | null;
  if (settings && typeof settings.primaryDomain === 'string' && settings.primaryDomain) {
    return `https://${settings.primaryDomain}`;
  }

  // Else the canonical host on record: their custom domain once it goes live,
  // or the free subdomain minted at signup until then.
  const domain = await prisma.domain.findFirst({
    where: { tenantId, status: 'active' },
    orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
    select: { host: true },
  });
  if (domain?.host) return `https://${domain.host}`;

  // No active host at all. There is nothing truthful left to build — every
  // candidate would be a guess at which company's zone this tenant lives in —
  // so this fails rather than mailing somebody a link to the wrong platform.
  throw new Error(`No active domain for tenant ${tenantId}; cannot build a site URL`);
}
