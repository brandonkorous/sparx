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
// ── A NAME SHE TYPED WAS THROWN AWAY ───────────────────────────────────────
//
// The clause below used to read the sender name ONLY inside the branch that
// had an address, so a shop with no verified domain — most of them — could type
// her business name into a field captioned "This is what your customers see in
// their inbox", save it, and have it silently discarded. Juniper Row did, and
// the send screen went on saying `Piggles <noreply@sparx.email>` after a
// refresh. That is not a fallback, it is a setting that does nothing.
//
// The name and the ADDRESS are separate questions. The address must be one the
// provider is authorized for; the name in front of it is only ever a label, and
// hers is the honest one — it is already the letterhead inside the very same
// email. So a typed name now rides the shared address.
//
// ── AND A BLANK ONE NAMES THE SHOP, NOT THE SOFTWARE ───────────────────────
//
// A blank sender name used to name the PLATFORM. That was parked here as a
// product decision, and Brandon answered it: the SITE's name, on both brands.
// It is the right answer for the same reason the typed name is — a recipient
// bought from Juniper Row, the letterhead inside says Juniper Row, and the
// software the shop happens to rent is not a party to that conversation. The
// platform's own name survives only where there is no site name to use at all.
//
// The name is read per SITE, never per tenant: one owner may run a bookshop and
// a bakery, and a newsletter from one must not go out under the other's name.
// That is why `propertyId` is a parameter rather than something looked up from
// the tenant — see [[feedback_site_is_the_business]].

import { prisma, withTenant } from '@wizeworks/db';
import { platformBrandIdentity, platformFrom } from '@wizeworks/brand-core';

const FALLBACK_FROM = 'sparx <noreply@sparx.email>';

/** The platform-wide sending identity, before the per-brand name is applied. */
function platformRawFrom(): string {
  return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
}

/** Just the address out of a `Name <addr>` header, or the whole string when it
 *  carries no name. */
function addressOf(from: string): string {
  return /<([^>]+)>/.exec(from)?.[1] ?? from.trim();
}

/**
 * A display name as a mail header may actually carry it.
 *
 * A bare name may hold letters, digits and a short list of marks; anything else
 * has to be quoted or the header parses as something other than a name.
 * `Bob's Parts, Inc. <a@b.c>` unquoted is a name, then a comma, then a second
 * recipient that does not exist — so a shop whose name has a comma in it is the
 * one whose mail breaks.
 */
function headerName(name: string): string {
  const trimmed = name.trim();
  if (/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~ ]+$/.test(trimmed)) return trimmed;
  return `"${trimmed.replace(/(["\\])/g, '\\$1')}"`;
}

/** `Name <address>`, or the bare address when there is no name to show. */
function headerFrom(name: string | null, address: string): string {
  const shown = name?.trim() ?? '';
  return shown === '' ? address : `${headerName(shown)} <${address}>`;
}

/**
 * The name this SITE trades under — what a customer knows the business as.
 *
 * `propertyId` is null only on call paths that predate per-site sends; those
 * mean the tenant's primary site, which is the same business the old per-tenant
 * row described. Best-effort: '' rather than throwing, because a name is a
 * label and mail that does not go out is worse than mail with a plainer one.
 */
async function siteName(tenantId: string, propertyId: string | null): Promise<string> {
  try {
    const row = await withTenant({ tenantId }, (tx) =>
      propertyId
        ? tx.property.findUnique({ where: { id: propertyId }, select: { name: true } })
        : tx.property.findFirst({ where: { isPrimary: true }, select: { name: true } })
    );
    return row?.name.trim() ?? '';
  } catch {
    return '';
  }
}

/** The platform's own name and address, for a tenant that has neither. */
async function platformSender(tenantId: string): Promise<string> {
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

/**
 * The `From` header for a send from one SITE.
 *
 * Three answers in order, and only the first two are the business's: the name
 * she typed, the name her site trades under, then — with nothing else to go on
 * — the platform. A verified address costs one query; the shared address costs
 * two.
 */
export async function buildTenantFrom(
  tenantId: string,
  fromName: string | null,
  fromAddress: string | null,
  propertyId?: string | null
): Promise<string> {
  const typed = fromName?.trim() ?? '';
  const shown = typed === '' ? await siteName(tenantId, propertyId ?? null) : typed;

  // Her own domain. The name is a label on it either way, so the same ladder
  // applies — a bare address is only what is left when the site has no name.
  if (fromAddress) return headerFrom(shown, fromAddress);

  const platform = await platformSender(tenantId);
  return shown === '' ? platform : headerFrom(shown, addressOf(platform));
}
