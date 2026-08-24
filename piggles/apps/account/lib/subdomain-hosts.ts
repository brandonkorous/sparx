import 'server-only';
import type { Prisma } from '@wizeworks/db';
import { PRODUCT } from '@piggles/config';

// The address the site is actually SERVED at, kept in step with the business's
// web address.
//
// Provisioning writes a `domains` row at sign-up — `<placeholder>.piggles.site`
// — and nothing rewrote it, so a salon called Halo & Hem had a business address
// of `halo-and-hem` and a stored site address of `swift-horizon-4860`. Issue
// #089.
//
// The row is a MIRROR, not the source: a `*.piggles.site` host is
// self-describing and the renderer decodes the business straight out of it,
// never consulting the table (wizeworks/apps/site/lib/site-context.ts). So the
// stale row was not merely ugly — it named a host that resolves to nothing, and
// it is the one the console shows and links to.

const SUFFIX = `.${PRODUCT.tenantSites.suffix}`;

/** The site label in front of the business label, or null for the main site —
 *  `<business>.piggles.site` and `<site>.<business>.piggles.site` are the two
 *  shapes minted, and a rename must not flatten the second into the first. */
function siteLabelOf(host: string): string | null {
  const labels = host.slice(0, -SUFFIX.length).split('.');
  return labels.length === 2 ? (labels[0] ?? null) : null;
}

/**
 * Bring this business's free addresses into line with its web address.
 *
 * Best-effort per row: an address somebody else already holds leaves that row
 * alone rather than failing a sign-up. Only `subdomain` rows — a domain the
 * customer owns is theirs and is never rewritten, and only those can be
 * re-derived, since a custom host encodes nothing about who it is.
 */
export async function claimSubdomainHosts(
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
