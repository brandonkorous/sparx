import 'server-only';
import type { Prisma } from '@wizeworks/db';
import { PRODUCT } from '@piggles/config';

// Turning "Thistle & Rye" into the web address `thistle-and-rye.piggles.site`.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// A tenant is born with a generated placeholder slug — `quiet-haven-3783` —
// because sign-up asks for an email and a password and not for a business name.
// The generator says why, and names the step that was meant to resolve it:
//
//   "at sign-up the user doesn't yet know what they're building, so we hand them
//    a unique, readable placeholder and let them personalize it in the onboarding
//    Workspace step."
//
// **Piggles has no Workspace step.** Onboarding is two questions and a look, by
// design — so nothing ever personalised the placeholder, and a bakery's permanent
// public address was `quiet-haven-3783.piggles.site`. Issue #010.
//
// Onboarding is where the business name is first known, so it is where the
// address gets claimed. Seconds after sign-up, nothing has been published and no
// customer has ever seen the placeholder, which is the one moment this is free to
// do.
//
// ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
//
// Fail onboarding. A name that slugifies to nothing usable, or to something
// already taken, leaves the placeholder in place and says nothing — a person
// cannot be blocked from starting a business because somebody else got to
// "thistle-and-rye" first. (This used to add "the address is changeable later
// from the console". It is not: the Domains pane offers no field at all.)

/** Words dropped from the front of a slug — a business called "The Reading Room"
 *  wants `reading-room`, and a leading article makes every alphabetical list
 *  wrong. Only stripped when something survives. */
const LEADING_NOISE = /^(the|a|an)-/;

/**
 * A business name as a subdomain label.
 *
 * `&` becomes `and` rather than vanishing — "Thistle & Rye" is said "Thistle and
 * Rye", so `thistle-and-rye` is what somebody would type, and `thistle-rye` is a
 * word nobody uses. Accents fold to their base letters so "Tomás" survives as
 * `tomas` rather than losing a character.
 *
 * Returns null when nothing usable is left (a name that is entirely punctuation
 * or non-Latin script), which is the caller's signal to keep the placeholder.
 */
export function slugifyBusinessName(name: string): string | null {
  const slug = name
    .normalize('NFKD')
    // Strip the combining marks NFKD just separated out: é → e + ◌́ → e.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(LEADING_NOISE, '')
    // A DNS label caps at 63 characters, and `tenants.slug` is varchar(63) for
    // that reason. Trim to a whole word so the address does not end mid-syllable.
    .slice(0, 63)
    .replace(/-+$/, '');

  return slug.length >= 2 ? slug : null;
}

/**
 * Claim the address for this business, or leave the placeholder alone.
 *
 * Takes the transaction the rename is already running in, so the slug and the
 * name land together or not at all — a tenant renamed to "Thistle & Rye" whose
 * address stayed `quiet-haven-3783` is exactly the split this fixes.
 *
 * Returns the slug in force afterwards, for logging.
 */
export async function claimBusinessSlug(
  tx: Prisma.TransactionClient,
  tenantId: string,
  businessName: string,
  currentSlug: string
): Promise<string> {
  const slug = await claimSlug(tx, tenantId, businessName, currentSlug);
  // Unconditionally, even when the slug did not move: a business whose slug is
  // already right can still be serving from a stale host (issue #089).
  await claimSubdomainHosts(tx, tenantId, slug);
  return slug;
}

async function claimSlug(
  tx: Prisma.TransactionClient,
  tenantId: string,
  businessName: string,
  currentSlug: string
): Promise<string> {
  const wanted = slugifyBusinessName(businessName);
  if (!wanted || wanted === currentSlug) return currentSlug;

  // `tenants.slug` is globally unique across BOTH brands — one tenant pool, one
  // index — so this asks the whole table, not just Piggles'. A taken name is not
  // an error; it is somebody else's shop.
  const taken = await tx.tenant.findUnique({ where: { slug: wanted }, select: { id: true } });
  if (taken && taken.id !== tenantId) return currentSlug;

  await tx.tenant.update({ where: { id: tenantId }, data: { slug: wanted } });
  return wanted;
}

// ── THE ADDRESS THE SITE IS ACTUALLY SERVED AT ──────────────────────────────
//
// The slug above is only half the address. Provisioning writes a `domains` row
// at sign-up — `<placeholder>.piggles.site` — and nothing rewrote it, so a salon
// called Halo & Hem had a business slug of `halo-and-hem` and a stored site
// address of `swift-horizon-4860.piggles.site`. Issue #089.
//
// The row is a MIRROR, not the source: a `*.piggles.site` host is self-describing
// and the renderer decodes the business straight out of it, never consulting the
// table (wizeworks/apps/site/lib/site-context.ts). So the stale row was not
// merely ugly — it named a host that resolves to nothing, and it is the one the
// console shows and links to.

const SUFFIX = `.${PRODUCT.tenantSites.suffix}`;

/** The site label in front of the business label, or null for the main site —
 *  `<business>.piggles.site` and `<site>.<business>.piggles.site` are the two
 *  shapes minted, and a rename must not flatten the second into the first. */
function siteLabelOf(host: string): string | null {
  const labels = host.slice(0, -SUFFIX.length).split('.');
  return labels.length === 2 ? (labels[0] ?? null) : null;
}

/**
 * Bring this business's free addresses into line with its slug.
 *
 * Best-effort per row, like the slug claim: an address somebody else already
 * holds leaves that row alone rather than failing a sign-up. Only `subdomain`
 * rows — a domain the customer owns is theirs and is never rewritten, and only
 * those can be re-derived, since a custom host encodes nothing about who it is.
 */
async function claimSubdomainHosts(
  tx: Prisma.TransactionClient,
  tenantId: string,
  slug: string
): Promise<void> {
  const rows = await tx.domain.findMany({
    where: { tenantId, type: 'subdomain' },
    select: { id: true, host: true },
  });

  for (const row of rows) {
    if (!row.host.endsWith(SUFFIX)) continue;
    const siteLabel = siteLabelOf(row.host);
    const wanted = siteLabel ? `${siteLabel}.${slug}${SUFFIX}` : `${slug}${SUFFIX}`;
    if (wanted === row.host) continue;

    const taken = await tx.domain.findUnique({ where: { host: wanted }, select: { id: true } });
    if (taken && taken.id !== row.id) continue;

    await tx.domain.update({ where: { id: row.id }, data: { host: wanted } });
  }
}
