// Resolves the shopper-facing base URL for the ambient tenant's site. Used to
// build the password-reset link so the email points at the shopper's ACTUAL
// site, never a client-supplied origin (a token-phishing vector).
//
// The address comes from the one resolver every customer-facing link uses
// (`@wizeworks/db/site-origin`): the primary site's own domain once it works, the
// tenant's chosen primary domain, else the subdomain it was minted on. This used
// to be a third copy of that question with its own order (the primary-domain
// setting first, then ANY live domain row of any site), so a reset link and the
// order emails could name two different addresses for one shop; two answers to
// one question is how sparx persona issue 064 happened.
//
// It never guesses a brand. The fallback used to be a CONSTRUCTED `<slug>.sparx.zone`,
// which named one brand's zone for every tenant on the platform, so a shopper of a
// Piggles business was sent to a host under another company's domain. The shared
// resolver mints in the zone read off the subdomain the tenant was provisioned on.

import { tenantStore, withTenant } from '@wizeworks/db';
import { resolveSiteOrigin } from '@wizeworks/db/site-origin';

export async function resolveStoreBaseUrl(): Promise<string> {
  const tenantId = tenantStore.getTenantIdOrThrow();
  return withTenant({ tenantId }, (tx) => resolveSiteOrigin(tx, tenantId, null));
}
