#!/usr/bin/env tsx
// Backfill — take the demo company's name off the pages of real businesses.
//
// WHY: installing a design stamped its own `seoTitle` and `seoDescription` onto every
// page it created. Those are written about the demo company the design was built
// around, so a real business ended up with:
//
//     Forge Fitness Studio   →  "Help & Support — Tempo"
//     Halden Consulting      →  "Customers — Mosaic"
//     Juniper Row (archive)  →  "About Kestrel — clothes that stay"
//     Juniper Row (journal)  →  "About Vérane — the maison"
//
// That is the `<title>`: the browser tab, the search result, the link preview and the
// name a bookmark takes. Nothing on the page shows it, so it is the one piece of
// installed content an owner cannot find by looking at her own site (issue 852).
//
// Issue 210 settled the rule — "a design gives you a LOOK; your name is yours" — and
// stopped the installer writing the sample `businessName` and tagline. These two
// columns are the same value one table over and were never reached.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// The source is fixed: `siteService.installedPageColumns` is the allow-list both
// install seams write through, and the blueprint updater no longer merges the two
// either. This closes the rows already written — issue 073's lesson, and the half
// that would make the fix a no-op for every business already trading.
//
// ── WHAT IT WILL AND WILL NOT TOUCH ──────────────────────────────────────────
//
// It compares the live row against the BASELINE the install recorded — the exact
// text the design handed over (docs/55 §4). A value is cleared only when the two are
// identical, character for character. A title the owner wrote, or edited, or partly
// edited, differs from the baseline and is left exactly as it is. There is no
// pattern matching and no list of demo names to keep in step.
//
// It also strips the two keys from the BASELINE itself, and that is not tidying: the
// untouched panel from issue 849 reports a page as still-the-example by comparing
// base to live. Clearing the row without clearing the base would make every one of
// these pages look edited, and the panel would go quiet about content that really is
// still the design's.
//
// Measured on the development database when this was written:
//
//     235 pages still carry the design's exact title, 76 of them PUBLISHED,
//     across 10 sites
//
// AFTERWARDS the page titles come from the business's own data and keep up with it:
// `apps/site/app/layout.tsx` sets `title: { default: site.name, template: '%s · ' +
// site.name }`, so Home reads "Juniper Row Archive" and About reads "About · Juniper
// Row Archive". The description is omitted, which that same layout already argued
// for: a crawler with no description writes a snippet from the page, "which is
// always truer than a template guess about what kind of business this is".
//
// IDEMPOTENT: a second run finds nothing, because a cleared row no longer equals its
// baseline and a stripped baseline no longer carries the key.
//
// RLS: `builder_pages` and `tenant_blueprint_install_artifacts` are both tenant
// scoped and FORCE RLS, so every read and write runs inside `withTenant`. `tenants`
// is not, so that read is plain (wizeworks/packages/db/CLAUDE.md).
//
// DRY-RUN by default; pass `--apply` to write.
//
//   pnpm --filter @wizeworks/db db:backfill:design-page-titles
//   pnpm --filter @wizeworks/db db:backfill:design-page-titles -- --apply

import { prisma, withTenant } from '../src/index';

const APPLY = process.argv.includes('--apply');

/** Short enough to read in a log line, long enough to recognize. */
function clip(text: string, max = 58): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max)}…`;
}

/** The baseline as an object, or null for anything that is not one. A baseline that
 *  cannot be read is not evidence of anything, so the page is left alone. */
function baselineOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function main(): Promise<void> {
  const tenants = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM tenants ORDER BY created_at
  `;

  let scanned = 0;
  let cleared = 0;
  let published = 0;
  let kept = 0;
  const sites = new Set<string>();

  for (const tenant of tenants) {
    await withTenant({ tenantId: tenant.id }, async (tx) => {
      const artifacts = await tx.tenantBlueprintInstallArtifact.findMany({
        where: { tenantId: tenant.id, kind: 'page', refId: { not: null } },
        select: { id: true, refId: true, baseline: true },
      });
      if (artifacts.length === 0) return;

      for (const artifact of artifacts) {
        const base = baselineOf(artifact.baseline);
        if (!base || !artifact.refId) continue;

        const baseTitle = typeof base.seoTitle === 'string' ? base.seoTitle : null;
        const baseDesc = typeof base.seoDescription === 'string' ? base.seoDescription : null;
        if (baseTitle === null && baseDesc === null) continue;

        const row = await tx.builderPage.findUnique({
          where: { id: artifact.refId },
          select: {
            id: true,
            name: true,
            seoTitle: true,
            seoDescription: true,
            publishedAt: true,
            property: { select: { slug: true } },
          },
        });
        // A page the owner deleted is the opposite of untouched, and a read that
        // finds nothing is not evidence. Either way there is nothing to repair.
        if (!row) continue;

        scanned += 1;
        const titleIsTheDesigns = baseTitle !== null && row.seoTitle === baseTitle;
        const descIsTheDesigns = baseDesc !== null && row.seoDescription === baseDesc;
        if (!titleIsTheDesigns && !descIsTheDesigns) {
          kept += 1;
          continue;
        }

        cleared += 1;
        if (row.publishedAt) published += 1;
        sites.add(`${tenant.name} · ${row.property.slug}`);

        if (APPLY) {
          await tx.builderPage.update({
            where: { id: row.id },
            data: {
              ...(titleIsTheDesigns ? { seoTitle: null } : {}),
              ...(descIsTheDesigns ? { seoDescription: null } : {}),
            },
          });
          // The baseline goes with it, or the untouched panel reads a cleared row
          // as the owner's own edit and stops reporting the page at all.
          const next = { ...base };
          if (titleIsTheDesigns) delete next.seoTitle;
          if (descIsTheDesigns) delete next.seoDescription;
          await tx.tenantBlueprintInstallArtifact.update({
            where: { id: artifact.id },
            data: { baseline: next as never },
          });
        }

        console.log(
          `${APPLY ? 'cleared' : 'would clear'} ${tenant.name} · ${row.property.slug} · ${row.name}` +
            `${row.publishedAt ? ' (published)' : ''}\n` +
            (titleIsTheDesigns ? `    title  ${clip(row.seoTitle ?? '')}\n` : '') +
            (descIsTheDesigns ? `    text   ${clip(row.seoDescription ?? '')}\n` : '')
        );
      }
    });
  }

  console.log('───');
  console.log(
    `${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${String(cleared)} of ${String(scanned)} installed page(s) ` +
      `still carried the design's own title or description — ${String(published)} of them published, ` +
      `across ${String(sites.size)} site(s).`
  );
  console.log(`${String(kept)} page(s) had been written by their owner and were left alone.`);
  if (!APPLY && cleared > 0) console.log('Re-run with `-- --apply` to write.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err: unknown) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
