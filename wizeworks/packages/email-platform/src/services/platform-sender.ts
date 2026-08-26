// Who a TENANT's own email is addressed from.
//
// Two cases, and only the second one is interesting:
//
//   • The tenant has verified a sending domain and set an address. That address
//     IS the answer — it is their domain, their name, their reputation.
//   • They have not. The send then leaves on the PLATFORM's address, because
//     that is the only domain the provider is authorized to send for.
//
// The second case is where the leak was. It resolved to the literal
// `sparx <noreply@sparx.email>`, so a Piggles business's first newsletter — sent
// before they had got as far as verifying a domain, which is most of them —
// reached their customers under a company neither party had heard of.
//
// The ADDRESS moves too, once a brand has one: `platformFrom` returns a brand's
// own `<BRAND>_EMAIL_FROM` verbatim, and the Mailgun provider posts a message
// through the domain its `From` names (`SPARX_MAILGUN_DOMAINS`) so the DKIM
// signature aligns. Absent both, only the NAME in front of the shared address
// is corrected — which is what every brand gets until its domain is verified.
//
// ── A SECOND COPY OF THIS SHIPPED, AND THE COPY WON ────────────────────────
//
// api-rest's `buildFrom` repeated this logic with the platform name hardcoded,
// and it runs at DISPATCH — after the correct value is stamped at enqueue, and
// spread over it. So every scheduled send, which is every broadcast, went out
// under the wrong brand no matter what this function returned. It now delegates
// here. If you are about to write a third "who is this from", don't.
//
// ── WHAT THIS DELIBERATELY DOES NOT DECIDE ─────────────────────────────────
//
// Whether an unconfigured tenant send should name the PLATFORM at all, rather
// than the tenant's own shop ("Bob's Parts <noreply@sparx.email>"). That is
// arguably better and it is a product decision, not a leak — it changes what
// every sparx tenant's broadcast has always said. Fixing "names the wrong
// company" and changing "names the platform instead of the shop" are two
// different changes, and bundling the second into the first is how a product
// decision gets made by nobody.

import { prisma } from '@wizeworks/db';
import { platformBrandIdentity, platformFrom } from '@wizeworks/brand-core';

const FALLBACK_FROM = 'sparx <noreply@sparx.email>';

/** The platform-wide sending identity, before the per-brand name is applied. */
function platformRawFrom(): string {
  return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
}

/**
 * The `From` header for a tenant send.
 *
 * `tenantId` is only read when the tenant has configured no address of their
 * own — a tenant with a verified domain costs no query.
 */
export async function buildTenantFrom(
  tenantId: string,
  fromName: string | null,
  fromAddress: string | null
): Promise<string> {
  if (fromAddress) return fromName ? `${fromName} <${fromAddress}>` : fromAddress;

  // `tenants` is the non-RLS dispatch row, so this reads on the plain client
  // with no tenant context. Best-effort: a failed lookup sends under the
  // platform default rather than dropping the mail, because a broadcast that
  // does not go out is worse than one with the wrong word in front of it.
  try {
    const row = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { platformBrand: true },
    });
    return platformFrom(platformBrandIdentity(row?.platformBrand), platformRawFrom());
  } catch {
    return platformRawFrom();
  }
}
