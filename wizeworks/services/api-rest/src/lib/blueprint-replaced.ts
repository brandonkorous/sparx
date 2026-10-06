// Which design installs a later design has replaced (persona issue 273).
//
// Read by the installs list, so a replaced design stops saying "Added as
// drafts", and by uninstall, so removing one leaves the site's CURRENT header
// and footer alone: they are no longer that design's to clear.

import { withTenant } from '@wizeworks/db';

/**
 * The installs on a site whose pages are all gone: a design added later replaced
 * them (persona issue 273).
 *
 * Adding a design to a site that already has one REPLACES that site's pages, and
 * the earlier install's record stayed as it was, still "Added as drafts", with an
 * Update on offer, over nine pages that no longer existed. Devi's main site
 * listed Fashion Boutique (Minimal) that way for six weeks.
 *
 * Worked out on READ from the install's own page records rather than stored, so
 * every install already in this state reads right with no data repair, and a
 * design that is later re-added reads right again on its own. An install with no
 * pages at all (an email-only design) is never "replaced": there was nothing to
 * replace.
 */
export async function replacedInstallIds(
  tenantId: string,
  installIds: string[]
): Promise<Set<string>> {
  if (installIds.length === 0) return new Set();
  return withTenant({ tenantId }, async (tx) => {
    const pages = await tx.tenantBlueprintInstallArtifact.findMany({
      where: { installId: { in: installIds }, kind: 'page', refId: { not: null } },
      select: { installId: true, refId: true },
    });
    const live = new Set(
      (
        await tx.builderPage.findMany({
          where: { id: { in: pages.flatMap((a) => (a.refId ? [a.refId] : [])) } },
          select: { id: true },
        })
      ).map((page) => page.id)
    );
    const hasPages = new Set(pages.map((a) => a.installId));
    const hasLivePage = new Set(
      pages.filter((a) => a.refId && live.has(a.refId)).map((a) => a.installId)
    );
    return new Set([...hasPages].filter((id) => !hasLivePage.has(id)));
  });
}
