import 'server-only';
import type { Prisma } from '@wizeworks/db';
import { prisma } from '@wizeworks/db';
import { RESERVED_ADDRESSES, slugifyAddress, type AddressVerdict } from './address-rules';
import { claimSubdomainHosts } from './subdomain-hosts';

// Claiming the web address — `thistle-and-rye.piggles.site`.
//
// A tenant is born with a generated placeholder (`quiet-haven-3783`) because
// sign-up asks for an email and a password and not for a business name. The
// generator names the step that was meant to resolve it: "let them personalize
// it in the onboarding Workspace step." **Piggles has no Workspace step**, so
// nothing ever did. Issue #010.
//
// The string rules live in `address-rules.ts` (the browser needs them too); this
// file is the half that touches the database.

export { slugifyAddress, slugifyBusinessName, type AddressVerdict } from './address-rules';

/**
 * Is this address available to this business?
 *
 * `tenants.slug` is globally unique across BOTH brands — one tenant pool, one
 * index — so this asks the whole table, not just Piggles'. A taken address is
 * not an error, it is somebody else's shop.
 */
export async function checkAddress(typed: string, tenantId: string): Promise<AddressVerdict> {
  const slug = slugifyAddress(typed);
  if (!slug) return 'unusable';
  if (RESERVED_ADDRESSES.has(slug)) return 'reserved';

  const holder = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!holder) return 'free';
  return holder.id === tenantId ? 'yours' : 'taken';
}

/**
 * Take the address, and bring the site's own host into line with it.
 *
 * Takes the transaction the rename is already running in, so the name and the
 * address land together or not at all — a tenant renamed to "Thistle & Rye"
 * whose address stayed `quiet-haven-3783` is exactly the split this fixes.
 *
 * Throws `AddressTakenError` rather than falling back silently. It used to keep
 * the placeholder when the address was gone, which was right while the address
 * was invisible; now that she is looking at the field, handing her a different
 * one without saying so would be the same defect one screen later.
 */
export async function claimBusinessSlug(
  tx: Prisma.TransactionClient,
  tenantId: string,
  slug: string,
  currentSlug: string
): Promise<string> {
  if (slug !== currentSlug) {
    if (RESERVED_ADDRESSES.has(slug)) throw new AddressTakenError(slug);
    const holder = await tx.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (holder && holder.id !== tenantId) throw new AddressTakenError(slug);

    await tx.tenant.update({ where: { id: tenantId }, data: { slug } });
  }

  // Unconditionally, even when the address did not move: a business whose slug
  // is already right can still be serving from a stale host (issue #089).
  await claimSubdomainHosts(tx, tenantId, slug);
  return slug;
}

export class AddressTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`web address already taken: ${slug}`);
    this.name = 'AddressTakenError';
  }
}
